import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMBERS, STARTING_BALANCE, simulateHistory } from "../src/lib/seed-data.ts";
import {
  settleFixed, bankPnl, lineFor, oddsFrom, remainingCapacity,
  minBackingFor, MIN_STAKE, type Placed,
} from "../src/lib/market.ts";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`);

test("the circle is a closed system: no money is created across 130+ bets", () => {
  const sim = simulateHistory();
  const start = MEMBERS.length * STARTING_BALANCE;
  const end = MEMBERS.reduce((t, m) => t + sim.balances[m.key], 0);
  near(end, start, 1e-6);
});

test("every bet is zero sum: what the proposer loses, the bettors win", () => {
  const sim = simulateHistory();
  for (const b of sim.bets) {
    const s = settleFixed(b.stakes, b.outcome);
    const bettorsNet = s.payouts.reduce((t, p) => t + p.profit, 0)
      - b.stakes.filter((x) => x.side !== b.outcome).reduce((t, x) => t + x.amount, 0);
    near(bettorsNet, -b.proposerPnl, 1e-6);
  }
});

test("every taker is on the opposite side to the proposer", () => {
  const sim = simulateHistory();
  for (const b of sim.bets) {
    const takerSide = b.proposerSide === "A" ? "B" : "A";
    for (const st of b.stakes) {
      assert.equal(st.side, takerSide, `bet ${b.index} had someone on the proposer's own side`);
    }
  }
});

test("a live bet always has at least one taker", () => {
  const sim = simulateHistory();
  for (const b of sim.bets) {
    assert.ok(b.stakes.length > 0, `bet ${b.index} went live with nobody taking it`);
  }
});

test("a proposer can never lose more than they posted", () => {
  const sim = simulateHistory();
  for (const b of sim.bets) {
    assert.ok(
      -b.proposerPnl <= b.liability + 1e-6,
      `bet ${b.index}: lost ${-b.proposerPnl} on a ${b.liability} backing`
    );
  }
});

test("capacity is bounded by what the proposer put up, not a global cap", () => {
  const odds = oddsFrom(lineFor(1124, 1477));
  const small = remainingCapacity([], "A", odds.multiplierA, 5);
  const large = remainingCapacity([], "A", odds.multiplierA, 20);
  assert.ok(large > small * 3.5, "backing more should open up proportionally more room");
  // Filling it exactly puts the proposer on their limit, never past it.
  const filled: Placed[] = [{ userId: "x", side: "A", amount: large, multiplier: odds.multiplierA }];
  near(-bankPnl(filled, "A"), 20, 1e-6);
});

test("nobody can take a side the proposer has already fully covered", () => {
  const odds = oddsFrom(lineFor(1124, 1477));
  const filled: Placed[] = [
    { userId: "x", side: "A", amount: remainingCapacity([], "A", odds.multiplierA, 20), multiplier: odds.multiplierA },
  ];
  assert.equal(remainingCapacity(filled, "A", odds.multiplierA, 20), 0);
});

/**
 * Every bet the seed puts on screen must actually be takeable. A backing too
 * small for the odds produces a bet that looks live and silently refuses every
 * stake — which is exactly what shipped once.
 */
test("every seeded live bet can absorb at least a minimum stake", () => {
  const sim = simulateHistory();
  const templateElo = sim.templateElo;
  const LIVE = [
    { subject: "akkhil", tpl: "d1", cat: "dares", side: "B", liability: 60, taken: 0 },
    { subject: "akkhil", tpl: "d2", cat: "dares", side: "B", liability: 40, taken: 0 },
    { subject: "shash", tpl: "g5", cat: "grades", side: "A", liability: 40, taken: 15 },
    { subject: "yaxin", tpl: "s1", cat: "sports", side: "A", liability: 30, taken: 12 },
  ] as const;

  for (const b of LIVE) {
    const odds = oddsFrom(lineFor(sim.ratings[b.subject][b.cat], templateElo[b.tpl]));
    const takerSide = b.side === "A" ? "B" : "A";
    const mult = takerSide === "A" ? odds.multiplierA : odds.multiplierB;

    // Backing must clear the floor for these odds.
    assert.ok(
      b.liability >= minBackingFor(mult),
      `${b.tpl}: $${b.liability} backing at ${mult.toFixed(2)}x needs at least $${minBackingFor(mult)}`
    );

    // And an untaken bet must have room for someone to actually bet.
    if (b.taken === 0) {
      const room = remainingCapacity([], takerSide as any, mult, b.liability);
      assert.ok(room >= MIN_STAKE, `${b.tpl}: only $${room.toFixed(2)} of room on an untouched bet`);
    }
  }
});
