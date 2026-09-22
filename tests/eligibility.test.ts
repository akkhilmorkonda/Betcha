import { test } from "node:test";
import assert from "node:assert/strict";
import { selfDeal, permittedSide } from "../src/lib/eligibility.ts";
import type { Side } from "../src/lib/market.ts";
import { mulberry32 } from "../src/lib/rng.ts";

/**
 * THE INVARIANT: no position ever pays a person for their own underperformance.
 *
 * Side A is always "the subject does it". Side B is always "they don't". The
 * subject on B and the head-to-head opponent on A are the two positions that
 * profit from failure the holder controls. Both must be refused. Everything
 * else must be allowed, because over-blocking kills the feature that makes the
 * product work — backing yourself.
 */

const SUBJECT = "u_subject";
const OPPONENT = "u_opponent";
const BYSTANDER = "u_bystander";
const SIDES: Side[] = ["A", "B"];

test("the subject may back themselves to do it", () => {
  assert.equal(selfDeal({ userId: SUBJECT, side: "A", subjectId: SUBJECT }), null);
});

test("the subject may NOT back themselves to fail", () => {
  assert.equal(
    selfDeal({ userId: SUBJECT, side: "B", subjectId: SUBJECT }),
    "subject-against-self"
  );
});

test("the head-to-head opponent may back themselves to win", () => {
  assert.equal(
    selfDeal({ userId: OPPONENT, side: "B", subjectId: SUBJECT, opponentId: OPPONENT }),
    null
  );
});

test("the head-to-head opponent may NOT back their own loss", () => {
  assert.equal(
    selfDeal({ userId: OPPONENT, side: "A", subjectId: SUBJECT, opponentId: OPPONENT }),
    "opponent-against-self"
  );
});

test("a bystander may take either side of a solo bet", () => {
  for (const side of SIDES) {
    assert.equal(selfDeal({ userId: BYSTANDER, side, subjectId: SUBJECT }), null);
  }
});

test("a bystander may take either side of a head-to-head bet", () => {
  for (const side of SIDES) {
    assert.equal(
      selfDeal({ userId: BYSTANDER, side, subjectId: SUBJECT, opponentId: OPPONENT }),
      null
    );
  }
});

test("a null or absent opponentId does not accidentally match anyone", () => {
  // An empty-string userId against a null opponent must not collide.
  assert.equal(selfDeal({ userId: "", side: "A", subjectId: SUBJECT, opponentId: null }), null);
  assert.equal(selfDeal({ userId: "", side: "B", subjectId: SUBJECT, opponentId: null }), null);
  assert.equal(
    selfDeal({ userId: "", side: "B", subjectId: SUBJECT, opponentId: undefined }),
    null
  );
});

test("a degenerate bet where subject and opponent are the same person allows only A", () => {
  // The subject rule is the stricter one and must win, rather than the two
  // rules cancelling out and letting the person take whichever side they like.
  assert.equal(selfDeal({ userId: SUBJECT, side: "A", subjectId: SUBJECT, opponentId: SUBJECT }), null);
  assert.equal(
    selfDeal({ userId: SUBJECT, side: "B", subjectId: SUBJECT, opponentId: SUBJECT }),
    "subject-against-self"
  );
});

test("permittedSide agrees with selfDeal on every combination", () => {
  const people = [SUBJECT, OPPONENT, BYSTANDER];
  const opponents: (string | null)[] = [null, OPPONENT];

  for (const userId of people) {
    for (const opponentId of opponents) {
      const allowed = permittedSide({ userId, subjectId: SUBJECT, opponentId });
      for (const side of SIDES) {
        const violation = selfDeal({ userId, side, subjectId: SUBJECT, opponentId });
        if (allowed === null) {
          assert.equal(violation, null, `bystander ${userId} blocked on ${side}`);
        } else {
          assert.equal(
            violation === null,
            side === allowed,
            `${userId} on ${side}: permittedSide says ${allowed}`
          );
        }
      }
    }
  }
});

test("FUZZ: an interested party is never allowed the side that profits from their own failure", () => {
  const rand = mulberry32(3185);
  const ids = ["a", "b", "c", "d"];
  let blockedCount = 0;

  for (let i = 0; i < 20_000; i++) {
    const subjectId = ids[Math.floor(rand() * ids.length)];
    const hasOpponent = rand() < 0.5;
    const opponentId = hasOpponent ? ids[Math.floor(rand() * ids.length)] : null;
    const userId = ids[Math.floor(rand() * ids.length)];
    const side: Side = rand() < 0.5 ? "A" : "B";

    const violation = selfDeal({ userId, side, subjectId, opponentId });

    // The two forbidden shapes, stated independently of the implementation.
    const profitsFromOwnFailure =
      (userId === subjectId && side === "B") ||
      (opponentId !== null && userId === opponentId && side === "A" && userId !== subjectId);

    if (profitsFromOwnFailure) {
      assert.notEqual(
        violation,
        null,
        `allowed a self-deal: user=${userId} side=${side} subject=${subjectId} opp=${opponentId}`
      );
      blockedCount++;
    }

    // Never block anyone with no stake in the outcome.
    if (userId !== subjectId && userId !== opponentId) {
      assert.equal(violation, null, `blocked a bystander: ${userId} on ${side}`);
    }
  }

  // Sanity: the fuzzer actually exercised the blocked paths.
  assert.ok(blockedCount > 1000, `only ${blockedCount} self-deals generated`);
});
