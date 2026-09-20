import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lineFor, oddsFrom, bankPnl, worstCaseExposure, remainingCapacity,
  settleFixed, minBackingFor, MIN_STAKE, MIN_LIABILITY,
  MIN_PROB, MAX_PROB, type Placed, type Side,
} from "../src/lib/market.ts";
import { mulberry32 } from "../src/lib/rng.ts";

/**
 * THE INVARIANT: whoever opens a bet can never lose more than they put up.
 * Not "usually", not "in the cases we thought of". Fuzzed over thousands of
 * random circles, ratings, stake sequences and outcomes.
 */
test("FUZZ: a proposer never loses more than they posted, across 5000 bets", () => {
  const rand = mulberry32(99);
  let worstOvershoot = 0;
  let tightest = Infinity;

  for (let i = 0; i < 5000; i++) {
    // Random matchup, anywhere in the plausible rating range.
    const subject = 800 + rand() * 1200;
    const difficulty = 800 + rand() * 1200;
    const liability = 1 + rand() * 200;
    const odds = oddsFrom(lineFor(subject, difficulty));

    const proposerSide: Side = rand() < 0.5 ? "A" : "B";
    const takerSide: Side = proposerSide === "A" ? "B" : "A";
    const mult = takerSide === "A" ? odds.multiplierA : odds.multiplierB;

    // A random number of takers, each grabbing a random slice of what's left.
    const positions: Placed[] = [];
    const takers = 1 + Math.floor(rand() * 6);
    for (let t = 0; t < takers; t++) {
      const room = remainingCapacity(positions, takerSide, mult, liability);
      if (!Number.isFinite(room)) break;
      const amount = room * rand();
      if (amount <= 0) continue;
      positions.push({ userId: `t${t}`, side: takerSide, amount, multiplier: mult });
    }
    if (positions.length === 0) continue;

    // Whatever happens, the proposer is never out more than they posted.
    for (const outcome of ["A", "B"] as const) {
      const loss = -bankPnl(positions, outcome);
      worstOvershoot = Math.max(worstOvershoot, loss - liability);
      if (loss > 0) tightest = Math.min(tightest, liability - loss);
    }
    assert.ok(
      worstCaseExposure(positions) <= liability + 1e-9,
      `overshoot: exposure ${worstCaseExposure(positions)} vs posted ${liability}`
    );
  }
  assert.ok(worstOvershoot <= 1e-9, `worst overshoot was ${worstOvershoot}`);
});

test("FUZZ: filling the capacity completely lands exactly on the limit, never past", () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 2000; i++) {
    const odds = oddsFrom(lineFor(800 + rand() * 1200, 800 + rand() * 1200));
    const liability = 1 + rand() * 100;
    const side: Side = rand() < 0.5 ? "A" : "B";
    const mult = side === "A" ? odds.multiplierA : odds.multiplierB;
    const room = remainingCapacity([], side, mult, liability);
    if (!Number.isFinite(room)) continue;

    const filled: Placed[] = [{ userId: "x", side, amount: room, multiplier: mult }];
    assert.ok(-bankPnl(filled, side) <= liability + 1e-9);
    // And a hair more must NOT fit.
    assert.equal(remainingCapacity(filled, side, mult, liability), 0);
  }
});

test("the clamped line can't be gamed: even at the extremes the cap holds", () => {
  for (const [s, d] of [[2400, 600], [600, 2400], [1200, 1200]] as const) {
    const odds = oddsFrom(lineFor(s, d));
    assert.ok(odds.probA >= MIN_PROB - 1e-12 && odds.probA <= MAX_PROB + 1e-12);
    for (const side of ["A", "B"] as const) {
      const mult = side === "A" ? odds.multiplierA : odds.multiplierB;
      const room = remainingCapacity([], side, mult, 50);
      if (!Number.isFinite(room)) continue;
      const filled: Placed[] = [{ userId: "x", side, amount: room, multiplier: mult }];
      assert.ok(-bankPnl(filled, side) <= 50 + 1e-9);
    }
  }
});

test("settling can never pay out more than the proposer put up", () => {
  const rand = mulberry32(31);
  for (let i = 0; i < 2000; i++) {
    const odds = oddsFrom(lineFor(800 + rand() * 1200, 800 + rand() * 1200));
    const liability = 1 + rand() * 100;
    const side: Side = rand() < 0.5 ? "A" : "B";
    const mult = side === "A" ? odds.multiplierA : odds.multiplierB;
    const room = remainingCapacity([], side, mult, liability);
    if (!Number.isFinite(room)) continue;

    const positions: Placed[] = [{ userId: "x", side, amount: room, multiplier: mult }];
    const s = settleFixed(positions, side);
    // What the winners are paid, beyond their own stakes, comes from the
    // proposer -- and it is bounded by what they posted.
    const outOfPocket = s.totalPaid - s.totalStaked;
    assert.ok(outOfPocket <= liability + 1e-9, `paid out ${outOfPocket} on a ${liability} backing`);
  }
});

// --- a bet nobody can take should never exist ---

test("REGRESSION: $3 behind a 5.35x line is not a valid bet", () => {
  // Yaxin proposed "Dev doesn't cold plunge" backed with $3. Dev (1222) against
  // the plunge (1477) prices takers at 5.35x, so $3 covers 69c — under the $1
  // minimum. The bet was unbettable from the moment it was created.
  const odds = oddsFrom(lineFor(1222, 1477));
  assert.ok(Math.abs(odds.multiplierA - 5.35) < 0.02, `expected ~5.35x, got ${odds.multiplierA}`);
  assert.ok(remainingCapacity([], "A", odds.multiplierA, 3) < MIN_STAKE);
  assert.ok(minBackingFor(odds.multiplierA) > 3, "should demand a bigger backing");
});

test("the minimum backing always supports at least one minimum stake", () => {
  const rand = mulberry32(2024);
  for (let i = 0; i < 3000; i++) {
    const odds = oddsFrom(lineFor(800 + rand() * 1200, 800 + rand() * 1200));
    for (const side of ["A", "B"] as const) {
      const mult = side === "A" ? odds.multiplierA : odds.multiplierB;
      const backing = minBackingFor(mult);
      const room = remainingCapacity([], side, mult, backing);
      assert.ok(room >= MIN_STAKE - 1e-9, `${backing} backing at ${mult}x only allows ${room}`);
    }
  }
});

test("a heavy favourite needs only the floor backing", () => {
  const odds = oddsFrom(lineFor(1900, 900)); // clamped to 0.95
  assert.equal(minBackingFor(odds.multiplierA), MIN_LIABILITY);
});
