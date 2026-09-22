import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeEvidence } from "@/lib/spark";
import { resolveBet, startVote, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";
import { evidenceRefusal } from "@/lib/eligibility";

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

  const refusal = evidenceRefusal({
    isCircleMember: membership !== null,
    betStatus: bet.status,
  });

  // A non-member is told the bet does not exist, matching GET /api/circle/[code]:
  // a stranger holding a bet id should not learn that it is real.
  if (refusal === "not-a-member")
    return NextResponse.json({ error: "No such bet" }, { status: 404 });
  if (refusal === "already-resolved")
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const { imageDataUrl } = (body ?? {}) as { imageDataUrl?: unknown };

  // The browser downscales to 1280px before sending. Anything much bigger than
  // that came from somewhere else and would stall the request, so refuse it
  // with a message rather than hanging mid-demo.
  const MAX_UPLOAD = 6_000_000; // ~4.5MB of image
  if (typeof imageDataUrl === "string" && imageDataUrl.length > MAX_UPLOAD) {
    return NextResponse.json(
      { error: "That photo is too large — retake it in the app so it gets resized." },
      { status: 413 }
    );
  }

  // "No photo" is a first-class path, not an error. Don't call Spark with nothing.
  if (!imageDataUrl) {
    await startVote(id);
    return NextResponse.json({
      evidence: {
        available: false,
        verdict: "unclear",
        claim: "",
        observations: [],
        confidence: 0,
        autoOutcome: null,
        reason: "No evidence submitted — sending to circle vote.",
      },
      resolved: false,
      votingStarted: true,
    });
  }

  const evidence = await analyzeEvidence({
    imageDataUrl: imageDataUrl as string,
    betTitle: bet.title,
    sideALabel: bet.sideALabel,
    sideBLabel: bet.sideBLabel,
  });

  try {
    if (evidence.autoOutcome) {
      await resolveBet({
        betId: id,
        outcome: evidence.autoOutcome,
        method: "evidence",
        sparkClaim: evidence.claim,
        sparkConfidence: evidence.confidence,
      });
      return NextResponse.json({ evidence, resolved: true });
    }
    await startVote(id, {
      sparkClaim: evidence.claim || null,
      sparkConfidence: evidence.confidence || null,
    });
    return NextResponse.json({ evidence, resolved: false, votingStarted: true });
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
