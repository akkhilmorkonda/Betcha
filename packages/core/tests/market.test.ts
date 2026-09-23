import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedScore,
  lineFor,
  oddsFrom,
  oddsForRatings,
  bankPnl,
  worstCaseExposure,
  remainingCapacity,
  settleFixed,
  ratingUpdate,
  headToHeadUpdate,
  kFactorFor,
  DEFAULT_LIABILITY,
  convictionWeight,
  forecastUpdate,
  MIN_CONVICTION,
  MAX_CONVICTION,
  MIN_PROB,
  MAX_PROB,
  type Placed,
} from "../src/market.ts";

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`);

test("equal ratings quote an even line", () => near(expectedScore(1200, 1200), 0.5));

test("a 400-point edge is the textbook 10:1 favourite", () =>
  near(expectedScore(1600, 1200), 10 / 11, 1e-12));

test("expectations are complementary", () =>
  near(expectedScore(1450, 1180) + expectedScore(1180, 1450), 1, 1e-12));

test("lines are clamped so neither side is ever unbettable", () => {
  assert.equal(lineFor(2400, 800), MAX_PROB);
  assert.equal(lineFor(800, 2400), MIN_PROB);
});

test("odds are the reciprocal of probability and sum to a fair book", () => {
  const o = oddsFrom(0.25);
  near(o.multiplierA, 4);
  near(o.multiplierB, 1 / 0.75);
  near(1 / o.multiplierA + 1 / o.multiplierB, 1, 1e-12);
});

// --- the property the whole redesign turns on ---

test("STAKES DO NOT MOVE THE LINE", () => {
  const before = oddsForRatings(1200, 1500);
  const flood: Placed[] = Array.from({ length: 20 }, (_, i) => ({
    userId: `u${i}`,
    side: "A" as const,
    amount: 500,
    multiplier: before.multiplierA,
  }));
  // Pricing takes ratings only — there is nowhere for stakes to enter.
  const after = oddsForRatings(1200, 1500);
  near(after.probA, before.probA, 1e-12);
  assert.equal(flood.length, 20);
});

test("only a rating change moves the line", () => {
  const before = oddsForRatings(1200, 1500);
  const after = oddsForRatings(1280, 1500); // subject won something
  assert.ok(after.probA > before.probA, "a better subject should be a shorter price");
  assert.ok(after.multiplierA < before.multiplierA);
});

test("two people with the same opinion get the same price whenever they bet", () => {
  const o = oddsForRatings(1340, 1290);
  const early = 100 * o.multiplierA;
  const late = 100 * oddsForRatings(1340, 1290).multiplierA;
  near(early, late, 1e-12);
});

// --- bank ---

test("the proposer collects losing stakes and pays winners their locked price", () => {
  const positions: Placed[] = [
    { userId: "a", side: "A", amount: 100, multiplier: 4 },
    { userId: "b", side: "B", amount: 300, multiplier: 1.333333 },
  ];
  const s = settleFixed(positions, "A");
  near(s.payouts[0].payout, 400);
  near(s.payouts[0].profit, 300);
  near(s.bankPnl, 0, 1e-3); // 300 collected, 300 profit paid
});

test("a fair book leaves the proposer flat on both outcomes", () => {
  const o = oddsFrom(0.25);
  const positions: Placed[] = [
    { userId: "a", side: "A", amount: 75, multiplier: o.multiplierA },
    { userId: "b", side: "B", amount: 225, multiplier: o.multiplierB },
  ];
  near(bankPnl(positions, "A"), 0, 1e-9);
  near(bankPnl(positions, "B"), 0, 1e-9);
});

test("everyone piling on one side is exactly what costs the proposer", () => {
  const o = oddsFrom(0.2); // 5x
  const positions: Placed[] = [
    { userId: "a", side: "A", amount: 200, multiplier: o.multiplierA },
    { userId: "b", side: "A", amount: 200, multiplier: o.multiplierA },
  ];
  near(bankPnl(positions, "A"), -1600); // 400 staked, 2000 paid out
  near(bankPnl(positions, "B"), 400);
  near(worstCaseExposure(positions), 1600);
});

test("losers forfeit their stake and get no payout row", () => {
  const positions: Placed[] = [
    { userId: "w", side: "A", amount: 50, multiplier: 3 },
    { userId: "l", side: "B", amount: 90, multiplier: 1.5 },
  ];
  const s = settleFixed(positions, "A");
  assert.equal(s.payouts.length, 1);
  assert.equal(s.payouts[0].userId, "w");
  near(s.totalStaked, 140);
  near(s.totalPaid, 150);
});

// --- liability cap ---

const CAP = 20; // what a proposer put up

test("capacity shrinks as the proposer's backing gets used up", () => {
  const o = oddsFrom(0.2);
  const empty = remainingCapacity([], "A", o.multiplierA, CAP);
  const loaded = remainingCapacity(
    [{ userId: "a", side: "A", amount: 3, multiplier: o.multiplierA }],
    "A",
    o.multiplierA,
    CAP
  );
  assert.ok(loaded < empty);
  near(empty, CAP / (o.multiplierA - 1));
});

test("money on the opposite side buys the proposer back some room", () => {
  const o = oddsFrom(0.2);
  const hedged = remainingCapacity(
    [{ userId: "b", side: "B", amount: 4, multiplier: o.multiplierB }],
    "A",
    o.multiplierA,
    CAP
  );
  assert.ok(hedged > remainingCapacity([], "A", o.multiplierA, CAP));
});

test("filling the capacity exactly lands the proposer on their limit", () => {
  const o = oddsFrom(0.2);
  const positions: Placed[] = [];
  const x = remainingCapacity(positions, "A", o.multiplierA, CAP);
  positions.push({ userId: "a", side: "A", amount: x, multiplier: o.multiplierA });
  near(-bankPnl(positions, "A"), CAP, 1e-6);
});

test("capacity is never negative once the backing is exhausted", () => {
  const o = oddsFrom(0.2);
  const over: Placed[] = [{ userId: "a", side: "A", amount: 500, multiplier: o.multiplierA }];
  assert.equal(remainingCapacity(over, "A", o.multiplierA, CAP), 0);
});

test("a heavy favourite is effectively uncapped", () => {
  assert.equal(remainingCapacity([], "A", 1, CAP), Infinity);
  assert.ok(DEFAULT_LIABILITY > 0);
});

// --- ratings ---

test("provisional K applies only to the first few rated bets", () => {
  assert.equal(kFactorFor(0), 64);
  assert.equal(kFactorFor(4), 64);
  assert.equal(kFactorFor(5), 32);
});

test("beating a hard challenge moves your rating more than an easy one", () => {
  assert.ok(ratingUpdate(1200, 1600, true).subjectAfter > ratingUpdate(1200, 900, true).subjectAfter);
});

test("the challenge rating moves opposite the subject and self-calibrates", () => {
  const r = ratingUpdate(1200, 1500, true);
  assert.ok(r.subjectAfter > r.subjectBefore);
  assert.ok(r.challengeAfter < r.challengeBefore);
});

test("losing to an easy challenge is punishing", () => {
  const r = ratingUpdate(1500, 1100, false);
  assert.ok(r.subjectBefore - r.subjectAfter > 25);
});

test("an expected result barely moves anything", () => {
  const r = ratingUpdate(1900, 900, true);
  assert.ok(Math.abs(r.subjectAfter - r.subjectBefore) < 1);
});

test("head-to-head Elo is zero sum", () => {
  const r = headToHeadUpdate(1300, 1180, true);
  near(r.aAfter + r.bAfter, 1300 + 1180, 1e-9);
});

// --- forecasting rating ---

test("calling a long shot right is worth far more than calling a favourite right", () => {
  const longShot = forecastUpdate(1200, 0.12, true, 100, 2000);
  const favourite = forecastUpdate(1200, 0.88, true, 100, 2000);
  assert.ok(longShot.after - 1200 > (favourite.after - 1200) * 5);
});

test("conviction is a fraction of bankroll, not an absolute stake", () => {
  // Same 100 units, very different courage.
  const poor = convictionWeight(100, 1103);
  const rich = convictionWeight(100, 3395);
  assert.ok(poor > rich, "the same stake from a smaller bankroll is a bigger call");
});

test("conviction is clamped at both ends", () => {
  assert.equal(convictionWeight(1, 100000), MIN_CONVICTION);
  assert.equal(convictionWeight(900, 1000), MAX_CONVICTION);
  assert.equal(convictionWeight(0, 0), MAX_CONVICTION); // broke: treat as all-in
});

test("a normal-sized call carries weight 1", () => {
  near(convictionWeight(50, 1000), 1, 1e-12); // 5% of bankroll
});

test("conviction is symmetric: go big and be wrong, fall twice as fast", () => {
  const bigWin = forecastUpdate(1200, 0.3, true, 200, 1000);
  const bigLoss = forecastUpdate(1200, 0.3, false, 200, 1000);
  const smallWin = forecastUpdate(1200, 0.3, true, 50, 1000);
  const smallLoss = forecastUpdate(1200, 0.3, false, 50, 1000);
  near((bigWin.after - 1200) / (smallWin.after - 1200), 2, 1e-9);
  near((bigLoss.after - 1200) / (smallLoss.after - 1200), 2, 1e-9);
});

test("an honest forecaster drifts nowhere, at any stake size", () => {
  // Someone whose calls are exactly as good as the line: expected move is zero.
  const p = 0.3;
  for (const [stake, bankroll] of [[10, 1000], [50, 1000], [400, 1000]] as const) {
    const win = forecastUpdate(1200, p, true, stake, bankroll).after - 1200;
    const loss = forecastUpdate(1200, p, false, stake, bankroll).after - 1200;
    near(p * win + (1 - p) * loss, 0, 1e-9);
  }
});

test("betting more often cannot inflate the rating", () => {
  let rating = 1200;
  const p = 0.5;
  for (let i = 0; i < 50; i++) {
    rating = forecastUpdate(rating, p, i % 2 === 0, 100, 1000).after;
  }
  near(rating, 1200, 1e-9); // 25 right, 25 wrong at a fair price
});

test("the forecasting rating never touches the line", () => {
  const before = oddsForRatings(1168, 1492);
  forecastUpdate(1900, 0.12, true, 500, 600);
  const after = oddsForRatings(1168, 1492);
  near(after.probA, before.probA, 1e-12);
});
