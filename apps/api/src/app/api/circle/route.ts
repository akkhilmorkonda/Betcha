import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { generateInviteCode, STARTING_BALANCE } from "@betcha/core";
import { readBody, rateLimit } from "@/lib/guard";
import { createCircleBody } from "@betcha/core";

/**
 * Create a circle. Half of the onboarding path that did not exist — before this,
 * the only circle in the world was the one the seed script wrote.
 *
 * The creator becomes its first member. Rating rows are not created here: a
 * Rating is per person per category and is created lazily the first time someone
 * is actually priced, so a brand-new circle carries no fabricated history.
 */
export async function POST(req: Request) {
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit(req, me, "createCircle");
  if (limited) return limited;

  const body = await readBody(req, createCircleBody);
  if (!body.ok) return body.response;
  const name = body.data.name;

  // inviteCode is @unique, so a collision is a constraint violation rather than
  // a silent overwrite. Retry a few times before giving up; at 32^6 codes this
  // effectively never runs twice.
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      const circle = await prisma.circle.create({
        data: {
          name,
          inviteCode,
          memberships: { create: { userId: me, balance: STARTING_BALANCE } },
        },
      });
      return NextResponse.json(
        { circle: { id: circle.id, name: circle.name, inviteCode: circle.inviteCode } },
        { status: 201 }
      );
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") continue; // unique collision on inviteCode, retry
      throw e;
    }
  }

  return NextResponse.json(
    { error: "Could not allocate an invite code, try again" },
    { status: 503 }
  );
}
