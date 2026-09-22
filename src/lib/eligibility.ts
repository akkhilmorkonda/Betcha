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

/**
 * WHO MAY END A BET EARLY, AND WHEN.
 *
 * A bet has a deadline, and the time between now and it belongs to the SUBJECT.
 * It is the whole thing they are being bet on: they have until Friday to run
 * the five miles, and until Friday they might still do it.
 *
 * `startVote` used to have no deadline guard at all, and the evidence route
 * calls it on two paths that need no photo to reach — a submission with no
 * image, and a photo Spark could not read. So any member of the circle could
 * post an empty submission on Monday and drop the bet to a circle vote with
 * four days left on it. The vote excludes stakeholders, so it is not theft; it
 * is the subject losing the time they were promised, which is worse than it
 * sounds when the vote then decides "did they do it" about a thing they still
 * had four days to do.
 *
 * The rule:
 *
 *   BEFORE the deadline, only the SUBJECT may force a vote. Conceding is theirs
 *   to do — it is their time being given up, and it is the one early exit
 *   nobody can be coerced into. It costs them money rather than making them
 *   any: eligibility above lets the subject hold only side A, so a subject who
 *   concedes is conceding their own position. Invariant 8 is untouched.
 *
 *   AFTER the deadline, any member of the circle may. The time is spent, the
 *   bet has to settle, and in a friend group the person with the camera and the
 *   person who cares about closing it out are usually not the subject.
 *
 *   The PROPOSER is deliberately NOT given the early exit, even though they
 *   back the bet with their own money. They are the counterparty to every
 *   position — usually on side B, "they don't" — so "let me end it before they
 *   can do it" is precisely the move the guard exists to stop. Backing a bet
 *   buys you the right to lose money on it, not the right to call time on it.
 *
 * Note what this rule does NOT cover: a photo that Spark reads as clearly true
 * or clearly false still resolves the bet outright, before the deadline,
 * submitted by anybody. That is not an early exit, it is the evidence arriving.
 * If the photo settles the question then the remaining time has nothing left to
 * do, and refusing it would mean a subject who finishes on Monday has to wait
 * until Friday to be paid.
 */
export type StartVoteRefusal =
  | "not-a-member"
  | "already-finished"
  | "before-deadline"
  | null;

export function startVoteRefusal(args: {
  isCircleMember: boolean;
  /** Is the caller the person the bet is about? */
  isSubject: boolean;
  /** pending | open | voting | resolved | void */
  betStatus: string;
  /** Epoch ms. */
  deadline: number;
  /** Epoch ms. */
  now: number;
}): StartVoteRefusal {
  if (!args.isCircleMember) return "not-a-member";
  if (args.betStatus === "resolved" || args.betStatus === "void")
    return "already-finished";

  // Already in a vote: the time this guard protects is gone either way, and the
  // route re-enters startVote to attach evidence metadata. Nothing to protect.
  if (args.betStatus === "voting") return null;

  // A non-finite or missing deadline is not a reason to open the gate. Treat it
  // as "the deadline has not passed", which is the cautious direction.
  const passed = Number.isFinite(args.deadline) && args.now > args.deadline;
  if (!passed && !args.isSubject) return "before-deadline";
  return null;
}

export function mayStartVote(args: Parameters<typeof startVoteRefusal>[0]): boolean {
  return startVoteRefusal(args) === null;
}

export function startVoteRefusalMessage(r: Exclude<StartVoteRefusal, null>): string {
  switch (r) {
    case "not-a-member":
      return "No such bet";
    case "already-finished":
      return "This bet is already settled";
    case "before-deadline":
      return "This bet still has time left — only the person it's about can call it early.";
  }
}
