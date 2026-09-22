import { test } from "node:test";
import assert from "node:assert/strict";
import { hit, sweep, POLICIES, type RateStore, type Policy } from "../src/lib/rate-limit.ts";
import { mulberry32 } from "../src/lib/rng.ts";

const P: Policy = { limit: 3, windowMs: 1000 };
const fresh = (): RateStore => new Map();

test("the first request through is allowed, and says what is left", () => {
  const r = hit(fresh(), "k", P, 0);
  assert.deepEqual(r, { ok: true, remaining: 2, retryAfterMs: 0 });
});

test("the limit is the limit: the nth request passes, the n+1th does not", () => {
  const s = fresh();
  for (let i = 0; i < P.limit; i++) {
    assert.equal(hit(s, "k", P, i).ok, true, `request ${i + 1} should pass`);
  }
  assert.equal(hit(s, "k", P, 4).ok, false, "one past the limit must be refused");
});

test("the window slides: quota comes back as old hits age out", () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) hit(s, "k", P, 100 + i);
  assert.equal(hit(s, "k", P, 200).ok, false);
  // The first hit was at t=100, so it leaves the window at t=1101.
  assert.equal(hit(s, "k", P, 1101).ok, true);
});

test("retryAfterMs points at the moment the window actually opens", () => {
  const s = fresh();
  hit(s, "k", P, 0);
  hit(s, "k", P, 10);
  hit(s, "k", P, 20);
  const r = hit(s, "k", P, 500);
  assert.equal(r.ok, false);
  // Oldest hit at t=0 expires at t=1000, so 500ms from now.
  assert.equal(r.retryAfterMs, 500);
});

/**
 * A refused request must not extend its own window. Counting rejections would
 * mean a caller hammering the endpoint never gets back in — the limiter would
 * turn a burst into a permanent lockout.
 */
test("refused requests are not counted, so hammering cannot self-extend the block", () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) hit(s, "k", P, i);
  // Hammer it well past the limit, right up to the edge of the window.
  for (let t = 10; t < 999; t++) hit(s, "k", P, t);
  // The original three hits still expire on schedule.
  assert.equal(hit(s, "k", P, 1001).ok, true, "hammering extended the block");
});

test("keys are independent: one caller cannot spend another's quota", () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) hit(s, "a", P, i);
  assert.equal(hit(s, "a", P, 5).ok, false);
  assert.equal(hit(s, "b", P, 5).ok, true, "a different key must have its own quota");
});

test("FUZZ: a key never exceeds its limit inside any window", () => {
  const rand = mulberry32(2024);
  for (let trial = 0; trial < 500; trial++) {
    const policy: Policy = {
      limit: 1 + Math.floor(rand() * 10),
      windowMs: 100 + Math.floor(rand() * 5000),
    };
    const s = fresh();
    const allowed: number[] = [];
    let now = 0;
    for (let i = 0; i < 200; i++) {
      now += Math.floor(rand() * 200);
      if (hit(s, "k", policy, now).ok) allowed.push(now);
    }
    // For every accepted request, count how many were accepted in the window
    // ending at it. That count must never exceed the limit.
    for (let i = 0; i < allowed.length; i++) {
      const from = allowed[i] - policy.windowMs;
      const inWindow = allowed.filter((t) => t > from && t <= allowed[i]).length;
      assert.ok(
        inWindow <= policy.limit,
        `${inWindow} allowed in a window of ${policy.windowMs}ms with limit ${policy.limit}`
      );
    }
  }
});

test("sweep drops only keys with nothing live left", () => {
  const s = fresh();
  hit(s, "old", P, 0);
  hit(s, "new", P, 5000);
  assert.equal(sweep(s, 5000, P.windowMs), 1);
  assert.equal(s.has("old"), false);
  assert.equal(s.has("new"), true);
});

/**
 * Evidence is the most expensive thing a member can do to a BET: it calls a
 * paid vision model and can settle the bet, paying out everyone's positions.
 * So it must never be looser than the other per-bet actions.
 *
 * Circle create and join are excluded deliberately — they are rarer by nature
 * and tighter still, which is fine. An earlier version of this test claimed
 * evidence was the tightest policy overall and failed for that reason.
 */
test("evidence is never looser than the other per-bet actions", () => {
  const perMinute = (name: keyof typeof POLICIES) =>
    (POLICIES[name].limit / POLICIES[name].windowMs) * 60_000;

  for (const name of ["createBet", "placePosition", "castVote"] as const) {
    assert.ok(
      perMinute("submitEvidence") <= perMinute(name),
      `submitEvidence (${perMinute("submitEvidence")}/min) is looser than ${name} (${perMinute(name)}/min)`
    );
  }
});

test("every policy is a positive limit over a positive window", () => {
  for (const [name, p] of Object.entries(POLICIES)) {
    assert.ok(p.limit > 0, `${name} has a non-positive limit`);
    assert.ok(p.windowMs > 0, `${name} has a non-positive window`);
    assert.ok(Number.isInteger(p.limit), `${name} has a fractional limit`);
  }
});
