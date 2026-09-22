/**
 * The demo circle. Ratings are NOT hand-typed — they are produced by running a
 * hand-written history of resolved bets through the real engine in market.ts.
 * Each member has a hidden "true skill" per category that decides outcomes;
 * Elo then has to discover it, exactly as it would with real users.
 */
import {
  DEFAULT_ELO,
  expectedScore,
  lineFor,
  oddsFrom,
  settleFixed,
  bankPnl,
  remainingCapacity,
  ratingUpdate,
  forecastUpdate,
  DEFAULT_ELO as BASE,
  CENTS,
  MIN_STAKE,
  MIN_LIABILITY,
  type Placed,
} from "./market.ts";
import { mulberry32 } from "./rng.ts";

export interface SeedMember {
  key: string;
  name: string;
  /** Hidden ground truth used only to generate history. Never stored. */
  trueSkill: Record<string, number>;
  /**
   * How much better than the posted line this person reads a situation, 0 to 1.
   * Hidden; the forecasting rating has to discover it, same as skill.
   */
  edge: number;
}

export const MEMBERS: SeedMember[] = [
  { key: "akkhil", name: "Akkhil", trueSkill: { grades: 1560, sports: 1180, dares: 1040 }, edge: 0.34 },
  { key: "shash", name: "Shash", trueSkill: { grades: 1230, sports: 1540, dares: 1320 }, edge: 0.42 },
  { key: "yaxin", name: "Yaxin", trueSkill: { grades: 1390, sports: 1210, dares: 1580 }, edge: 0.22 },
  { key: "dev", name: "Dev", trueSkill: { grades: 1140, sports: 1430, dares: 1250 }, edge: 0.82 },
  { key: "priya", name: "Priya", trueSkill: { grades: 1470, sports: 1070, dares: 1160 }, edge: 0.55 },
  { key: "marcus", name: "Marcus", trueSkill: { grades: 1060, sports: 1340, dares: 1490 }, edge: 0.06 },
];

export interface SeedTemplate {
  key: string;
  category: string;
  text: string;
  difficultyElo: number;
}

export const TEMPLATES: SeedTemplate[] = [
  // grades
  { key: "g1", category: "grades", text: "{subject} gets an A on the next exam", difficultyElo: 1450 },
  { key: "g2", category: "grades", text: "{subject} beats the class average", difficultyElo: 1150 },
  { key: "g3", category: "grades", text: "{subject} finishes the pset before midnight", difficultyElo: 1250 },
  { key: "g4", category: "grades", text: "{subject} pulls a 4.0 this semester", difficultyElo: 1680 },
  { key: "g5", category: "grades", text: "{subject} gets an A- or better in orgo", difficultyElo: 1700 },
  { key: "g6", category: "grades", text: "{subject} makes every lecture this week", difficultyElo: 1300 },
  { key: "g7", category: "grades", text: "{subject} turns in the lab report without an extension", difficultyElo: 1350 },
  { key: "g8", category: "grades", text: "{subject} scores top 10% on the midterm", difficultyElo: 1550 },
  { key: "g9", category: "grades", text: "{subject} passes the quiz they didn't study for", difficultyElo: 1400 },
  { key: "g10", category: "grades", text: "{subject} breaks the curve on the final", difficultyElo: 1760 },
  // sports
  { key: "s1", category: "sports", text: "{subject} runs 5 miles under 40 minutes", difficultyElo: 1400 },
  { key: "s2", category: "sports", text: "{subject} beats their bench PR", difficultyElo: 1450 },
  { key: "s3", category: "sports", text: "{subject} makes 7 of 10 free throws", difficultyElo: 1350 },
  { key: "s4", category: "sports", text: "{subject} closes all rings every day this week", difficultyElo: 1300 },
  { key: "s5", category: "sports", text: "{subject} wins their next pickup game", difficultyElo: 1250 },
  { key: "s6", category: "sports", text: "{subject} holds a 3-minute plank", difficultyElo: 1380 },
  { key: "s7", category: "sports", text: "{subject} runs a sub-8 mile", difficultyElo: 1420 },
  { key: "s8", category: "sports", text: "{subject} hits 12k steps a day for 5 days", difficultyElo: 1280 },
  { key: "s9", category: "sports", text: "{subject} swims 20 laps without stopping", difficultyElo: 1500 },
  // dares
  { key: "d1", category: "dares", text: "{subject} cold-plunges for 3 minutes", difficultyElo: 1500 },
  { key: "d2", category: "dares", text: "{subject} does 100 pushups in one sitting", difficultyElo: 1450 },
  { key: "d3", category: "dares", text: "{subject} goes a full day without caffeine", difficultyElo: 1350 },
  { key: "d4", category: "dares", text: "{subject} finishes the ghost pepper wing", difficultyElo: 1620 },
  { key: "d5", category: "dares", text: "{subject} does karaoke stone cold sober", difficultyElo: 1400 },
  { key: "d6", category: "dares", text: "{subject} wakes up at 5am three days straight", difficultyElo: 1560 },
  { key: "d7", category: "dares", text: "{subject} goes a week without Instagram", difficultyElo: 1500 },
  { key: "d8", category: "dares", text: "{subject} eats lunch alone in the dining hall", difficultyElo: 1220 },
  { key: "d9", category: "dares", text: "{subject} runs a lap around the quad barefoot", difficultyElo: 1330 },
];

export const BETS_PER_MEMBER_CATEGORY = 13; // proposed; many find no taker
/** Money here is CENTS, like everywhere else. $120. */
export const STARTING_BALANCE = 120 * CENTS;
export const MAX_STAKE_FRACTION = 0.09; // nobody shoves their whole balance in
export const MAX_STAKE = 26 * CENTS;
/** Share of their balance a proposer is willing to put behind one bet. */
export const LIABILITY_FRACTION = 0.12;
export const MAX_LIABILITY_SEED = 36 * CENTS; // friends don't wire four figures at each other

export interface SimBet {
  index: number;
  category: string;
  subjectKey: string;
  templateKey: string;
  title: string;
  proposerKey: string;
  proposerSide: "A" | "B";
  liability: number;
  proposerPnl: number;
  subjectEloAtOpen: number;
  difficultyEloAtOpen: number;
  openingProbA: number;
  multiplierA: number;
  multiplierB: number;
  stakes: (Placed & { userKey: string; prob: number; balanceAtEntry: number })[];
  outcome: "A" | "B";
  daysAgo: number;
}

export interface SimResult {
  forecast: Record<string, { elo: number; bets: number; hits: number }>;
  ratings: Record<string, Record<string, number>>;
  record: Record<string, Record<string, { wins: number; losses: number }>>;
  templateElo: Record<string, number>;
  balances: Record<string, number>;
  bets: SimBet[];
}

export interface SimOptions {
  start?: number;
  maxStake?: number;
  maxLiability?: number;
  stakeFraction?: number;
  liabilityFraction?: number;
}

export function simulateHistory(seed = 517, opts: SimOptions = {}): SimResult {
  const START = opts.start ?? STARTING_BALANCE;
  const STAKE_CAP = opts.maxStake ?? MAX_STAKE;
  const LIAB_CAP = opts.maxLiability ?? MAX_LIABILITY_SEED;
  const STAKE_FRAC = opts.stakeFraction ?? MAX_STAKE_FRACTION;
  const LIAB_FRAC = opts.liabilityFraction ?? LIABILITY_FRACTION;
  const rand = mulberry32(seed);
  const cats = ["grades", "sports", "dares"];

  const ratings: Record<string, Record<string, number>> = {};
  const record: Record<string, Record<string, { wins: number; losses: number }>> = {};
  const balances: Record<string, number> = {};
  for (const m of MEMBERS) {
    ratings[m.key] = { grades: DEFAULT_ELO, sports: DEFAULT_ELO, dares: DEFAULT_ELO, custom: DEFAULT_ELO };
    record[m.key] = { grades: { wins: 0, losses: 0 }, sports: { wins: 0, losses: 0 }, dares: { wins: 0, losses: 0 }, custom: { wins: 0, losses: 0 } };
    balances[m.key] = START;
  }
  const forecast: Record<string, { elo: number; bets: number; hits: number }> = {};
  for (const m of MEMBERS) forecast[m.key] = { elo: BASE, bets: 0, hits: 0 };
  const templateElo: Record<string, number> = {};
  for (const t of TEMPLATES) templateElo[t.key] = t.difficultyElo;

  const bets: SimBet[] = [];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const ratedBets: Record<string, Record<string, number>> = {};
  for (const m of MEMBERS) ratedBets[m.key] = { grades: 0, sports: 0, dares: 0, custom: 0 };

  // Round robin: every member gets the same number of rated bets in every
  // category, so nobody ends the seed with an unrated skill.
  const schedule: { subject: SeedMember; category: string }[] = [];
  for (let round = 0; round < BETS_PER_MEMBER_CATEGORY; round++) {
    for (const category of cats) {
      for (const subject of MEMBERS) schedule.push({ subject, category });
    }
  }
  // Shuffle so the timeline looks organic rather than blocked by category.
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
  }

  schedule.forEach(({ subject, category }, i) => {
    const template = pick(TEMPLATES.filter((t) => t.category === category));

    const subjectElo = ratings[subject.key][category];
    const difficultyElo = templateElo[template.key];
    const line = lineFor(subjectElo, difficultyElo);
    const odds = oddsFrom(line);

    // Ground truth decides the outcome, not the line.
    const trueProb = expectedScore(subject.trueSkill[category], template.difficultyElo);
    const outcome: "A" | "B" = rand() < trueProb ? "A" : "B";

    // A private belief: part ground truth, part the posted line, part noise.
    const beliefOf = (m: SeedMember) =>
      Math.min(0.97, Math.max(0.03, trueProb * m.edge + line * (1 - m.edge) + (rand() - 0.5) * 0.26));

    // Someone other than the subject proposes it, picks THEIR side, and posts
    // what they're willing to lose on it.
    const candidates = MEMBERS.filter((m) => m.key !== subject.key && balances[m.key] >= START * 0.12);
    if (candidates.length === 0) return;
    const proposer = pick(candidates);
    const proposerSide: "A" | "B" = beliefOf(proposer) > line ? "A" : "B";
    const takerSide: "A" | "B" = proposerSide === "A" ? "B" : "A";
    const liability = Math.max(
      MIN_LIABILITY,
      Math.min(LIAB_CAP, Math.floor(balances[proposer.key] * LIAB_FRAC))
    );
    balances[proposer.key] -= liability; // escrowed the moment they post it

    // Only members who DISAGREE with the proposer can take them on, and there
    // is only one side available to take.
    const multiplier = takerSide === "A" ? odds.multiplierA : odds.multiplierB;
    const prob = takerSide === "A" ? odds.probA : odds.probB;

    const taken: Placed[] = [];
    const stakes = MEMBERS.filter((m) => m.key !== subject.key && m.key !== proposer.key)
      .sort(() => rand() - 0.5)
      .map((b) => {
        const belief = beliefOf(b);
        const disagrees = takerSide === "A" ? belief > line : belief < line;
        if (!disagrees) return null;

        const conviction = Math.abs(belief - line);
        const fraction = Math.min(STAKE_FRAC, 0.015 + conviction * 0.38);
        const cap = Math.max(0, Math.floor(balances[b.key] * STAKE_FRAC));
        const want = Math.min(Math.max(MIN_STAKE, Math.round(balances[b.key] * fraction)), cap, STAKE_CAP);
        // Can't take more than the proposer is still covering.
        const room = remainingCapacity(taken, takerSide, multiplier, liability);
        const amount = Math.min(want, room);
        if (amount <= 0) return null;

        const row = {
          userId: b.key,
          userKey: b.key,
          side: takerSide,
          amount,
          multiplier,
          prob,
          balanceAtEntry: balances[b.key],
        };
        taken.push(row);
        return row;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Nobody disagreed, so the bet never went live. Escrow back, nothing
    // happened — not even a rating change.
    if (stakes.length === 0) {
      balances[proposer.key] += liability;
      return;
    }

    for (const s of stakes) balances[s.userKey] -= s.amount;
    const result = settleFixed(stakes, outcome);
    for (const p of result.payouts) balances[p.userId] += p.payout;

    // Escrow comes back, plus or minus what the proposer made on it.
    const pPnl = bankPnl(stakes, outcome);
    balances[proposer.key] += liability + pPnl;

    for (const st of stakes) {
      const won = st.side === outcome;
      const f = forecast[st.userKey];
      f.elo = forecastUpdate(f.elo, st.prob, won, st.amount, st.balanceAtEntry).after;
      f.bets++;
      if (won) f.hits++;
    }

    const upd = ratingUpdate(subjectElo, difficultyElo, outcome === "A", ratedBets[subject.key][category]);
    ratings[subject.key][category] = upd.subjectAfter;
    templateElo[template.key] = upd.challengeAfter;
    ratedBets[subject.key][category]++;
    if (outcome === "A") record[subject.key][category].wins++;
    else record[subject.key][category].losses++;

    bets.push({
      index: i,
      category,
      subjectKey: subject.key,
      templateKey: template.key,
      title: template.text.replace("{subject}", subject.name),
      proposerKey: proposer.key,
      proposerSide,
      liability,
      proposerPnl: pPnl,
      subjectEloAtOpen: subjectElo,
      difficultyEloAtOpen: difficultyElo,
      openingProbA: line,
      multiplierA: odds.multiplierA,
      multiplierB: odds.multiplierB,
      stakes,
      outcome,
      daysAgo: schedule.length - i + 2,
    });
  });

  return { forecast, ratings, record, templateElo, balances, bets };
}
