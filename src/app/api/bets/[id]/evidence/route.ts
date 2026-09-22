import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeEvidence } from "@/lib/spark";
import { resolveBet, startVote, BetError, StartVoteError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";
import { evidenceRefusal } from "@/lib/eligibility";
import { moderateImage } from "@/lib/moderation";
import { readBody, rateLimit } from "@/lib/guard";
import { submitEvidenceBody } from "@/lib/schemas";

/** The no-photo shape the client already renders. */
const noEvidence = (reason: string) => ({
  available: false,
  verdict: "unclear" as const,
  claim: "",
  observations: [] as string[],
  confidence: 0,
  autoOutcome: null,
  reason,
});

/**
 * Photo evidence. Spark either settles it outright or the bet drops to a
 * circle vote — which is a normal outcome, not an error path.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // The tightest policy of the six: this calls a paid vision model and can
  // resolve a bet outright, paying out other members' positions.
  const limited = rateLimit(req, me, "submitEvidence");
  if (limited) return limited;

  // Authorize BEFORE reading the body. Submitting evidence resolves bets and
  // pays out other members' positions, so the caller must be in the bet's own
  // circle — `me` was previously read and then never used, which let anyone
  // holding a bet id settle a bet between six other people. See
  // maySubmitEvidence in eligibility.ts for why this is membership, not
  // subject-only.
  const bet = await prisma.bet.findUnique({ where: { id } });
  if (!bet) return NextResponse.json({ error: "No such bet" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { userId_circleId: { userId: me, circleId: bet.circleId } },
    select: { id: true },
  });
  const isCircleMember = membership !== null;

  const refusal = evidenceRefusal({ isCircleMember, betStatus: bet.status });

  // A non-member is told the bet does not exist, matching GET /api/circle/[code]:
  // a stranger holding a bet id should not learn that it is real.
  if (refusal === "not-a-member")
    return NextResponse.json({ error: "No such bet" }, { status: 404 });
  if (refusal === "already-resolved")
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  const body = await readBody(req, submitEvidenceBody);
  if (!body.ok) return body.response;
  const imageDataUrl = body.data.imageDataUrl;
  const by = { userId: me, isCircleMember };

  // "No photo" is a first-class path, not an error. Don't call Spark with nothing.
  // It IS, however, a request to end the bet, so it goes through the same
  // deadline guard as everything else here.
  if (!imageDataUrl) {
    try {
      await startVote(id, by);
    } catch (e) {
      if (e instanceof StartVoteError)
        return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    return NextResponse.json({
      evidence: noEvidence("No evidence submitted — sending to circle vote."),
      resolved: false,
      votingStarted: true,
    });
  }

  // CONTENT SAFETY, check two of two. Screen the photo BEFORE it goes anywhere
  // — before the vision model reads it, and well before it could reach a circle
  // vote where other members look at it. With no OPENAI_API_KEY this refuses:
  // there is no offline fallback for an image, so unreviewed means unscreened.
  // See the header of moderation.ts.
  const photo = await moderateImage({ imageDataUrl });
  if (photo.decision === "refuse")
    return NextResponse.json({ error: photo.reason }, { status: 400 });

  const evidence = await analyzeEvidence({
    imageDataUrl,
    betTitle: bet.title,
    sideALabel: bet.sideALabel,
    sideBLabel: bet.sideBLabel,
  });

  try {
    if (evidence.autoOutcome) {
      // Not an early exit: the evidence arrived and settles the question, so
      // there is nothing left for the remaining time to decide. Deliberately
      // not behind the deadline guard — see startVoteRefusal in eligibility.ts.
      await resolveBet({
        betId: id,
        outcome: evidence.autoOutcome,
        method: "evidence",
        sparkClaim: evidence.claim,
        sparkConfidence: evidence.confidence,
      });
      return NextResponse.json({ evidence, resolved: true });
    }

    await startVote(id, by, {
      sparkClaim: evidence.claim || null,
      sparkConfidence: evidence.confidence || null,
    });
    return NextResponse.json({ evidence, resolved: false, votingStarted: true });
  } catch (e) {
    // An inconclusive photo before the deadline is not an error either — the
    // bet simply stays open and the subject keeps the time they had left. Hand
    // back the verdict Spark produced so the submitter can see why it did not
    // settle, and say plainly that nothing happened to the bet.
    if (e instanceof StartVoteError && e.refusal === "before-deadline")
      return NextResponse.json({
        evidence: { ...evidence, reason: `${evidence.reason} ${e.message}`.trim() },
        resolved: false,
        votingStarted: false,
      });
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
