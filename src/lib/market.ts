/**
 * Betcha odds engine — fixed odds priced off Elo.
 *
 * Elo is a SKILL rating: how good a person is at the thing, per category. It
 * prices bets ABOUT that person. Solo bets price against a rated
 * ChallengeTemplate; head-to-head bets price against the opponent's rating.
 *
 * Money does not move the line. The line is a pure function of current ratings,
 * so two people with the same opinion get the same price whether they bet first
 * or last. It still moves during a session — because ratings move. Resolve one
 * bet and every open bet on that person in that category re-prices.
 *
 * Each position locks its multiplier at the moment it is placed, like taking a
 * price at a sportsbook. A circle bank is the counterparty, capped per bet.
 *
 * MONEY IS INTEGER MINOR UNITS — cents. Every amount, stake, payout, liability
 * and balance in this file is a whole number of cents, and $1 is 100. Nothing
 * here ever holds a fractional amount, because a ledger built on floats drifts:
 * add a third of a cent ten thousand times and the circle no longer sums to
 * what it started with. Ratings, probabilities and multipliers are NOT money
 * and stay floating point.
 *
 * Render with money() from format.ts, which is the only place cents become a
 * dollar string.
 */

/** Minor units per major unit. Money crosses into this file already in cents. */
export const CENTS = 100;

export const DEFAULT_ELO = 1200;
export const K_SUBJECT = 32; // people move fast
export const K_PROVISIONAL = 64; // first few rated bets move faster
export const PROVISIONAL_BETS = 5;
export const K_CHALLENGE = 16; // challenges aggregate across many uses, so slower

// Never quote a line at 0 or 1 — an unbettable side kills the demo.
export const MIN_PROB = 0.05;
export const MAX_PROB = 0.95;

/**
 * Whoever proposes a bet backs it: they post the most they are willing to lose,
 * and that money is escrowed from their balance until the bet settles. They are
 * the counterparty to every position taken on it.
 *
 * There is no house. Every dollar a bettor wins comes out of the proposer's
 * escrow, so the circle's total never changes.
 */
export const DEFAULT_LIABILITY = 25 * CENTS;
export const MIN_LIABILITY = 2 * CENTS;
export const MAX_LIABILITY = 150 * CENTS;
/** Nobody can stake less than this, so a bet must be able to absorb it. */
export const MIN_STAKE = 1 * CENTS;

// --- Forecasting rating ---
// A THIRD rating, separate from skill and challenge. It measures how well you
// call other people's bets. It never touches pricing.
export const K_FORECAST = 24;
/** A stake of this fraction of your bankroll counts as a normal-sized call. */
export const REFERENCE_FRACTION = 0.05;
export const MIN_CONVICTION = 0.25;
export const MAX_CONVICTION = 2;

export type Side = "A" | "B";

/** A placed position, with the price it locked in. `amount` is in cents. */
export interface Placed {
  userId: string;
  side: Side;
  amount: number;
  multiplier: number;
}

/**
 * What a winning stake returns, in whole cents, stake included.
 *
 * THE ONE ROUNDING SITE. settleFixed and bankPnl both go through this, so the
 * proposer's loss is always exactly the negative of what the bettors make — the
 * two can never disagree by a cent. Round anywhere else and conservation breaks
 * quietly, a cent at a time, in whichever direction the arithmetic happens to
 * fall.
 */
export function payoutFor(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

/** Standard Elo expectation: probability A beats B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function clampProb(p: number): number {
  return Math.min(MAX_PROB, Math.max(MIN_PROB, p));
}

/**
 * The line: probability the subject succeeds (side A). `difficultyElo` is the
 * challenge template's rating, or the opponent's rating. Called on every read,
 * with current ratings — not frozen at creation.
 */
export function lineFor(subjectElo: number, difficultyElo: number): number {
  return clampProb(expectedScore(subjectElo, difficultyElo));
}

/** Back-compat alias; the opening line is just the line at creation time. */
export const openingLine = lineFor;

export interface Odds {
  probA: number;
  probB: number;
  multiplierA: number;
  multiplierB: number;
}

/** Decimal odds: multiplier includes the stake back, so profit is stake*(m-1). */
export function oddsFrom(probA: number): Odds {
  const p = clampProb(probA);
  return { probA: p, probB: 1 - p, multiplierA: 1 / p, multiplierB: 1 / (1 - p) };
}

export function oddsForRatings(subjectElo: number, difficultyElo: number): Odds {
  return oddsFrom(lineFor(subjectElo, difficultyElo));
}

/**
 * The PROPOSER's profit or loss if `winner` comes in. They collect every losing
 * stake and pay each winner their profit. This is exactly the negative of what
 * the bettors make, so money only ever moves sideways.
 */
export function bankPnl(positions: Placed[], winner: Side): number {
  let losersStakes = 0;
  let winnersProfit = 0;
  for (const p of positions) {
    // payoutFor, not amount * (multiplier - 1): the bank's loss has to match the
    // rounded figure the winner is actually paid.
    if (p.side === winner) winnersProfit += payoutFor(p.amount, p.multiplier) - p.amount;
    else losersStakes += p.amount;
  }
  return losersStakes - winnersProfit;
}

/** How much the bank stands to lose in the worst case across both outcomes. */
export function worstCaseExposure(positions: Placed[]): number {
  return Math.max(0, -bankPnl(positions, "A"), -bankPnl(positions, "B"));
}

/**
 * How much more can be accepted on `side` at `multiplier` before the proposer's
 * loss on that outcome would exceed what they posted. Returns Infinity for a
 * heavy favourite, where the proposer risks almost nothing.
 */
export function remainingCapacity(
  positions: Placed[],
  side: Side,
  multiplier: number,
  cap: number
): number {
  if (multiplier <= 1) return Infinity;
  const headroom = cap + bankPnl(positions, side);
  // Integers, so this is exact — the old epsilon guarded against float error
  // leaving a sliver of headroom after the cap was filled exactly, which let
  // sub-cent stakes be added forever, each nudging the proposer past what they
  // agreed to. With cents there is no sliver.
  if (headroom <= 0) return 0;
  // Floor, never round: a capacity that rounded up would admit one stake that
  // pushes the proposer past their backing.
  let room = Math.floor(headroom / (multiplier - 1));
  // Then verify rather than trust the division. payoutFor rounds, so the cost of
  // admitting `room` is round(room * (m-1)), which can land a cent above the
  // headroom the division implied. The cost rises monotonically with room, so
  // stepping down until it fits is exact — and terminates in a step or two.
  while (room > 0 && payoutFor(room, multiplier) - room > headroom) room--;
  return room;
}

/**
 * The smallest backing that lets ANYONE take the bet at these odds.
 *
 * A proposer backing a long shot with pocket change creates a bet nobody can
 * touch: $3 against a 5.35x line only covers 69 cents of action, below the
 * minimum stake. Such a bet is dead on arrival, so it should never be created.
 */
export function minBackingFor(takerMultiplier: number, minStake = MIN_STAKE): number {
  if (takerMultiplier <= 1) return MIN_LIABILITY;
  return Math.max(MIN_LIABILITY, Math.ceil(minStake * (takerMultiplier - 1)));
}

export interface Settlement {
  payouts: { userId: string; stake: number; payout: number; profit: number }[];
  bankPnl: number;
  totalStaked: number;
  totalPaid: number;
}

/** Winners are paid at the price they locked. Losers forfeit their stake. */
export function settleFixed(positions: Placed[], winner: Side): Settlement {
  const payouts = positions
    .filter((p) => p.side === winner)
    .map((p) => {
      const payout = payoutFor(p.amount, p.multiplier);
      return { userId: p.userId, stake: p.amount, payout, profit: payout - p.amount };
    });

  return {
    payouts,
    bankPnl: bankPnl(positions, winner),
    totalStaked: positions.reduce((t, p) => t + p.amount, 0),
    totalPaid: payouts.reduce((t, p) => t + p.payout, 0),
  };
}

/**
 * New players are rated provisionally: a bigger K until they have a few
 * results, as chess federations do. Without it a fresh circle takes dozens of
 * bets to show any spread.
 */
export function kFactorFor(ratedBets: number): number {
  return ratedBets < PROVISIONAL_BETS ? K_PROVISIONAL : K_SUBJECT;
}

export interface RatingUpdate {
  subjectBefore: number;
  subjectAfter: number;
  challengeBefore: number;
  challengeAfter: number;
  expected: number;
}

/**
 * The subject's rating and the challenge's rating move in opposite directions,
 * so the template bank self-calibrates across the circle like puzzle ratings.
 */
export function ratingUpdate(
  subjectElo: number,
  challengeElo: number,
  subjectWon: boolean,
  subjectRatedBets = PROVISIONAL_BETS
): RatingUpdate {
  const expected = expectedScore(subjectElo, challengeElo);
  const delta = (subjectWon ? 1 : 0) - expected;
  return {
    subjectBefore: subjectElo,
    subjectAfter: subjectElo + kFactorFor(subjectRatedBets) * delta,
    challengeBefore: challengeElo,
    challengeAfter: challengeElo - K_CHALLENGE * delta,
    expected,
  };
}

/**
 * How hard a stake was to make, as a multiple of a normal call.
 *
 * Scaled by fraction of bankroll, not absolute size: Marcus staking 100 of his
 * 1,103 is a bigger call than Dev staking 100 of his 3,395, and the rating
 * should say so. Clamped so one all-in can never rewrite someone's rating.
 */
export function convictionWeight(stake: number, balanceAtPlacement: number): number {
  if (!(balanceAtPlacement > 0)) return MAX_CONVICTION;
  const fraction = stake / balanceAtPlacement;
  return Math.min(MAX_CONVICTION, Math.max(MIN_CONVICTION, fraction / REFERENCE_FRACTION));
}

export interface ForecastUpdate {
  before: number;
  after: number;
  expected: number;
  weight: number;
  delta: number;
}

/**
 * Rates a bettor against the price they took. The line already states the
 * expected score, so no opponent lookup is needed: backing a 12% shot that
 * lands is worth a lot, backing an 88% favourite that lands is worth almost
 * nothing.
 *
 * Conviction scales the move SYMMETRICALLY — go big and be wrong and you fall
 * twice as fast. That symmetry is what stops the rating being farmable: for an
 * honest forecaster the expected move is zero at any stake size, so betting
 * bigger or more often buys speed and variance, never drift.
 */
export function forecastUpdate(
  rating: number,
  impliedProbOfSideTaken: number,
  won: boolean,
  stake: number,
  balanceAtPlacement: number
): ForecastUpdate {
  const weight = convictionWeight(stake, balanceAtPlacement);
  const delta = (won ? 1 : 0) - impliedProbOfSideTaken;
  return {
    before: rating,
    after: rating + K_FORECAST * weight * delta,
    expected: impliedProbOfSideTaken,
    weight,
    delta,
  };
}

/** Head-to-head: both sides are people, so both move at the same K. */
export function headToHeadUpdate(
  eloA: number,
  eloB: number,
  aWon: boolean
): { aAfter: number; bAfter: number; expected: number } {
  const expected = expectedScore(eloA, eloB);
  const delta = (aWon ? 1 : 0) - expected;
  return { aAfter: eloA + K_SUBJECT * delta, bAfter: eloB - K_SUBJECT * delta, expected };
}
