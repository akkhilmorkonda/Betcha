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
