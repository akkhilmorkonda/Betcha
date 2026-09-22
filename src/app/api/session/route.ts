import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/**
 * Who am I? Read-only, and scoped to the caller's own record.
 *
 * There is deliberately no POST here. It used to accept a userId and switch the
 * active member — the demo's instant persona swap — which meant any caller could
 * become any user, with no credential of any kind. Identity is now established
 * only through Better Auth at /api/auth/*.
 */
export async function GET() {
  const id = await getSessionUserId();
  if (!id) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id },
    include: { ratings: true, memberships: { include: { circle: true } } },
  });
  return NextResponse.json({ user });
}
