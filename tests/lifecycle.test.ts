import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lineFor, oddsFrom, settleFixed, bankPnl, remainingCapacity,
  ratingUpdate, forecastUpdate, type Placed,
} from "../src/lib/market.ts";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`);

/**
 * One bet all the way through, exactly as the demo runs it.
 * Akkhil is 1124 in dares and 0-8; the cold plunge is rated 1477.
 * Dev proposes it and posts $20 that Akkhil can't do it.
 */
test("full lifecycle: back it, price it, fill it, settle it, re-rate", () => {
  const AKKHIL_DARES = 1124;
  const PLUNGE = 1477;
  const BACKING = 20;

  // 1. The line comes from ratings alone.
  const odds = oddsFrom(lineFor(AKKHIL_DARES, PLUNGE));
  assert.ok(odds.multiplierA > 7, "a real long shot");

  const balances: Record<string, number> = { dev: 43, shash: 12, priya: 6 };
  balances.dev -= BACKING; // escrowed the moment he proposes it
  near(balances.dev, 23);

  // 2. Shash takes the favourite for $3.
  const positions: Placed[] = [
    { userId: "shash", side: "B", amount: 3, multiplier: odds.multiplierB },
  ];
  balances.shash -= 3;

  // 3. Priya wants the long shot. She can only take what Dev is still covering
  //    — his $20, plus the $3 Shash just put on the other side.
  const room = remainingCapacity(positions, "A", odds.multiplierA, BACKING);
  assert.ok(room > 2.5 && room < 3.5, `room should be a few dollars, got ${room}`);
  positions.push({ userId: "priya", side: "A", amount: room, multiplier: odds.multiplierA });
  balances.priya -= room;

  // Filling it exactly puts Dev on his limit and never past it.
  near(-bankPnl(positions, "A"), BACKING, 1e-6);

  // 4. He does it. Winners paid at the price they locked.
  const s = settleFixed(positions, "A");
  assert.equal(s.payouts.length, 1);
  balances.priya += s.payouts[0].payout;
  balances.dev += BACKING + s.bankPnl; // escrow back, minus what he lost

  // 5. Nothing was created or destroyed. Dev is out exactly what the others
  //    are up, and the three of them hold the same total as when they started.
  near(balances.dev, 43 - BACKING);  // he posted $20 and lost all of it
  near(s.bankPnl, -BACKING);
  const total = balances.dev + balances.shash + balances.priya;
  near(total, 43 + 12 + 6);

  // 6. Skill and challenge move in opposite directions.
  const r = ratingUpdate(AKKHIL_DARES, PLUNGE, true, 8);
  assert.ok(r.subjectAfter > AKKHIL_DARES, "he gains for the upset");
  assert.ok(r.challengeAfter < PLUNGE, "the plunge gets cheaper");

  // 7. Re-pricing after the update gives a shorter price — the demo's close.
  const after = oddsFrom(lineFor(r.subjectAfter, r.challengeAfter));
  assert.ok(after.multiplierA < odds.multiplierA, "nobody gets that price again");

  // 8. Forecast ratings move, weighted by conviction.
  const priya = forecastUpdate(1077, odds.probA, true, room, 6);
  const shash = forecastUpdate(1242, odds.probB, false, 3, 12);
  assert.ok(priya.after > 1077, "called a long shot right");
  assert.ok(shash.after < 1242, "backed the favourite and lost");
});

test("a bet nobody takes costs the proposer nothing", () => {
  const s = settleFixed([], "A");
  assert.equal(s.payouts.length, 0);
  near(s.bankPnl, 0);
  near(s.totalStaked, 0);
});

test("a one-sided bet that loses is pure profit for the proposer", () => {
  const odds = oddsFrom(lineFor(1124, 1477));
  const positions: Placed[] = [
    { userId: "a", side: "A", amount: 1, multiplier: odds.multiplierA },
    { userId: "b", side: "A", amount: 1, multiplier: odds.multiplierA },
  ];
  const s = settleFixed(positions, "B");
  assert.equal(s.payouts.length, 0);
  near(s.bankPnl, 2); // he keeps both stakes, and nothing more
});
