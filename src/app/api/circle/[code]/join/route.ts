import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  canJoinCircle,
  isWellFormedInviteCode,
  normalizeInviteCode,
  STARTING_BALANCE,
} from "@/lib/circles";
import { rateLimit } from "@/lib/guard";

/**
 * Join a circle by invite code. The other half of onboarding.
 *
 * This is the one place an invite code grants anything, and all it grants is
 * membership — GET /api/circle/[code] checks membership, not the code.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // No body to validate, but codes are guessable by construction, so the
  // attempt rate is what stops someone walking the code space.
  const limited = rateLimit(req, me, "joinCircle");
  if (limited) return limited;

  const { code } = await params;
  if (!isWellFormedInviteCode(code)) {
    return NextResponse.json({ error: "No such circle" }, { status: 404 });
  }

  const circle = await prisma.circle.findUnique({
    where: { inviteCode: normalizeInviteCode(code) },
    include: { memberships: { select: { userId: true } } },
  });

  const verdict = canJoinCircle({
    circleExists: circle !== null,
    alreadyMember: circle?.memberships.some((m) => m.userId === me) ?? false,
    memberCount: circle?.memberships.length ?? 0,
  });

  if (!verdict.ok) {
    // Already a member is not a failure the user needs to see as one — it's what
    // tapping an invite link twice looks like. Report the circle, don't re-create
    // the membership, and above all don't reset their balance.
    if (verdict.status === 409 && verdict.reason === "Already a member") {
      return NextResponse.json({
        circle: { id: circle!.id, name: circle!.name, inviteCode: circle!.inviteCode },
        joined: false,
      });
    }
    return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
  }

  await prisma.membership.create({
    data: { userId: me, circleId: circle!.id, balance: STARTING_BALANCE },
  });

  return NextResponse.json(
    {
      circle: { id: circle!.id, name: circle!.name, inviteCode: circle!.inviteCode },
      joined: true,
    },
    { status: 201 }
  );
}
