import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selfDeal,
  permittedSide,
  evidenceRefusal,
  maySubmitEvidence,
  startVoteRefusal,
  mayStartVote,
} from "../src/eligibility.ts";
import type { Side } from "../src/market.ts";
import { mulberry32 } from "../src/rng.ts";

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

/**
 * THE INVARIANT: only someone inside the circle can move that circle's money.
 *
 * Submitting evidence is a write. A verdict Spark reads as clearly true or
 * clearly false resolves the bet and pays every position at its locked
 * multiplier; submitting nothing drops the bet to a circle vote. The route that
 * does this authenticated the caller and then ignored who they were.
 */
test("a stranger in no circle cannot submit evidence", () => {
  assert.equal(maySubmitEvidence({ isCircleMember: false, betStatus: "open" }), false);
  assert.equal(evidenceRefusal({ isCircleMember: false, betStatus: "open" }), "not-a-member");
});

test("a member of the bet's circle may submit", () => {
  assert.equal(maySubmitEvidence({ isCircleMember: true, betStatus: "open" }), true);
  assert.equal(evidenceRefusal({ isCircleMember: true, betStatus: "open" }), null);
});

test("a resolved bet is closed to further evidence, even for a member", () => {
  assert.equal(maySubmitEvidence({ isCircleMember: true, betStatus: "resolved" }), false);
  assert.equal(
    evidenceRefusal({ isCircleMember: true, betStatus: "resolved" }),
    "already-resolved"
  );
});

test("membership is checked before status, so a stranger never learns the bet resolved", () => {
  assert.equal(
    evidenceRefusal({ isCircleMember: false, betStatus: "resolved" }),
    "not-a-member"
  );
});

test("a member may still submit while a bet is pending or voting", () => {
  for (const status of ["open", "pending", "voting"]) {
    assert.equal(maySubmitEvidence({ isCircleMember: true, betStatus: status }), true);
  }
});

test("FUZZ: non-membership refuses across every status, with no exception", () => {
  const rand = mulberry32(31);
  const statuses = ["open", "pending", "voting", "resolved", "void", "", "OPEN", "garbage"];
  for (let i = 0; i < 5000; i++) {
    const betStatus = statuses[Math.floor(rand() * statuses.length)];
    assert.equal(
      maySubmitEvidence({ isCircleMember: false, betStatus }),
      false,
      `non-member allowed through on status ${betStatus}`
    );
    // And a member is refused only when the bet is already resolved.
    assert.equal(
      maySubmitEvidence({ isCircleMember: true, betStatus }),
      betStatus !== "resolved",
      `member verdict wrong on status ${betStatus}`
    );
  }
});

/**
 * WHO MAY END A BET EARLY.
 *
 * The time between now and the deadline belongs to the SUBJECT — it is the
 * thing being bet on. startVote had no deadline guard at all, so any member
 * could post an empty evidence submission on Monday and drop a Friday bet to a
 * circle vote with four days still on it.
 *
 * Before the deadline only the subject may call it. After it, any member may.
 * The proposer is deliberately not given the early exit: they are the
 * counterparty to every position, usually on "they don't", so "let me end it
 * before they can do it" is exactly the move this guard exists to stop.
 */

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;

const startVoteArgs = (over: Partial<Parameters<typeof startVoteRefusal>[0]> = {}) => ({
  isCircleMember: true,
  isSubject: false,
  betStatus: "open",
  deadline: NOW + 4 * HOUR,
  now: NOW,
  ...over,
});

test("a member cannot force an open bet to a vote before its deadline", () => {
  assert.equal(startVoteRefusal(startVoteArgs()), "before-deadline");
  assert.equal(mayStartVote(startVoteArgs()), false);
});

test("the subject may concede early — it is their time to give up", () => {
  assert.equal(startVoteRefusal(startVoteArgs({ isSubject: true })), null);
});

/**
 * The proposer backs the bet with their own money, which buys them the right to
 * lose it, not the right to call time on it. They are not the subject, so they
 * are refused by exactly the same branch as anyone else — this test exists so
 * nobody adds them as an exception later.
 */
test("the proposer gets no early exit, however much they have posted", () => {
  assert.equal(
    startVoteRefusal(startVoteArgs({ isSubject: false })),
    "before-deadline",
    "backing a bet must not buy the right to end it early"
  );
});

test("after the deadline any member may put it to the circle", () => {
  assert.equal(startVoteRefusal(startVoteArgs({ now: NOW + 5 * HOUR })), null);
  assert.equal(startVoteRefusal(startVoteArgs({ now: NOW + 5 * HOUR, isSubject: true })), null);
});

test("the deadline instant itself has not passed yet", () => {
  const at = startVoteArgs({ now: NOW + 4 * HOUR });
  assert.equal(startVoteRefusal(at), "before-deadline");
  assert.equal(startVoteRefusal({ ...at, now: NOW + 4 * HOUR + 1 }), null);
});

test("a non-member is refused before anything else is considered", () => {
  assert.equal(
    startVoteRefusal(
      startVoteArgs({ isCircleMember: false, isSubject: true, now: NOW + 99 * HOUR })
    ),
    "not-a-member"
  );
});

test("a finished bet cannot be dropped back into a vote", () => {
  for (const betStatus of ["resolved", "void"]) {
    assert.equal(
      startVoteRefusal(startVoteArgs({ betStatus, now: NOW + 99 * HOUR })),
      "already-finished"
    );
  }
});

/**
 * Already voting means the time this guard protects is gone either way, and the
 * evidence route re-enters startVote to attach the model's claim to the
 * resolution. There is nothing left to protect, so it passes.
 */
test("a bet already in a vote is not blocked by the deadline", () => {
  assert.equal(startVoteRefusal(startVoteArgs({ betStatus: "voting" })), null);
});

/** A missing or nonsense deadline is not a reason to open the gate. */
test("a non-finite deadline reads as 'not passed', which is the cautious side", () => {
  for (const deadline of [NaN, Infinity, -Infinity, undefined as unknown as number]) {
    assert.equal(startVoteRefusal(startVoteArgs({ deadline })), "before-deadline");
    assert.equal(startVoteRefusal(startVoteArgs({ deadline, isSubject: true })), null);
  }
});

test("FUZZ: nobody but the subject ends a live bet early, on any input", () => {
  const rand = mulberry32(0x5707e);
  const statuses = ["open", "pending", "voting", "resolved", "void", "", "garbage"];
  for (let i = 0; i < 20000; i++) {
    const isCircleMember = rand() < 0.8;
    const isSubject = rand() < 0.3;
    const betStatus = statuses[Math.floor(rand() * statuses.length)];
    const offset = Math.floor(rand() * 200 * HOUR) - 100 * HOUR;
    const deadline = NOW + offset;
    const args = { isCircleMember, isSubject, betStatus, deadline, now: NOW };
    const r = startVoteRefusal(args);

    if (!isCircleMember) {
      assert.equal(r, "not-a-member", "a non-member was let near a vote");
      continue;
    }
    if (betStatus === "resolved" || betStatus === "void") {
      assert.equal(r, "already-finished");
      continue;
    }
    if (betStatus === "voting") {
      assert.equal(r, null);
      continue;
    }

    const passed = NOW > deadline;
    // THE INVARIANT: a live bet with time left is ended only by its subject.
    if (!passed && !isSubject)
      assert.equal(r, "before-deadline", `time was taken from the subject at ${offset}ms`);
    else assert.equal(r, null, `wrongly refused: passed=${passed} subject=${isSubject}`);

    assert.equal(mayStartVote(args), r === null);
  }
});
