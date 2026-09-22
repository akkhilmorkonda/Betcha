import type { Side } from "./market.ts";

/**
 * WHO MAY TAKE WHICH SIDE.
 *
 * Pure, so the rule is an invariant the tests can hold rather than an `if`
 * buried in a Prisma call. `placePosition` in bets.ts is the only caller.
 *
 * Side A is always "the subject does it". Side B is always "they don't". In a
 * head-to-head, A is "the subject wins" and B is "the opponent wins". So there
 * are exactly two positions that pay a person for their own underperformance:
 *
 *   - the subject on B
 *   - the opponent on A
 *
 * Both are match-fixing, because both people control the outcome. Leave them
 * open and the dominant strategy in every circle is to back yourself to fail
 * and then fail on purpose — free money, and the circle's economy is dead
 * inside a week.
 *
 * The rule is deliberately asymmetric rather than a blanket ban on having a
 * stake in your own bet. Backing yourself to SUCCEED is the motivating loop and
 * the reason the product is fun; it stays legal. Only the against-self
 * direction is closed.
 */
export type SelfDeal = "subject-against-self" | "opponent-against-self" | null;

export function selfDeal(args: {
  userId: string;
  side: Side;
  subjectId: string;
  opponentId?: string | null;
}): SelfDeal {
  const { userId, side, subjectId, opponentId } = args;

  // Being the subject decides the answer outright — the opponent rule is never
  // consulted for them. That matters for the degenerate bet where subject and
  // opponent are the same person: without the early return, the two rules
  // between them block BOTH sides and the person can take no position at all.
  // createBet refuses to build that bet, so this is belt-and-braces, but it
  // keeps the function total and matches permittedSide below.
  if (userId === subjectId) return side === "A" ? null : "subject-against-self";
  if (opponentId && userId === opponentId)
    return side === "B" ? null : "opponent-against-self";
  return null;
}

/** The side a given member is allowed to take, or null if they're a bystander. */
export function permittedSide(args: {
  userId: string;
  subjectId: string;
  opponentId?: string | null;
}): Side | null {
  if (args.userId === args.subjectId) return "A";
  if (args.opponentId && args.userId === args.opponentId) return "B";
  return null;
}

/**
 * WHO MAY SUBMIT EVIDENCE.
 *
 * Submitting evidence is not a passive act. A photo Spark reads as clearly true
 * or clearly false resolves the bet outright and pays every position at its
 * locked multiplier; a submission with no photo drops the bet straight to a
 * circle vote. Either way the caller moves other people's money.
 *
 * The route used to require only that the caller be signed in. It read the user
 * id and then never used it, so anyone with a bet id — a stranger in no circle
 * at all — could settle a bet between six other people.
 *
 * Membership in the bet's own circle is the gate. It is deliberately not
 * narrowed to the subject: in a friend group the person holding the camera is
 * usually someone else, and the UI offers the control to every viewer of an
 * open bet. Stakeholders are already excluded from the vote itself by
 * eligibleVoterIds, so a forced vote is decided by people with nothing on it.
 */
export type EvidenceRefusal = "not-a-member" | "already-resolved" | null;

export function evidenceRefusal(args: {
  isCircleMember: boolean;
  betStatus: string;
}): EvidenceRefusal {
  if (!args.isCircleMember) return "not-a-member";
  if (args.betStatus === "resolved") return "already-resolved";
  return null;
}

export function maySubmitEvidence(args: {
  isCircleMember: boolean;
  betStatus: string;
}): boolean {
  return evidenceRefusal(args) === null;
}
