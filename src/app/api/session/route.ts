import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId, setSessionUserId } from "@/lib/session";

export async function GET() {
  const id = await getSessionUserId();
  if (!id) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id },
    include: { ratings: true, memberships: { include: { circle: true } } },
  });
  return NextResponse.json({ user });
}

/** Switch the active member. Powers the demo's instant persona swap. */
export async function POST(req: Request) {
  const { userId } = await req.json();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 });
  await setSessionUserId(user.id);
  return NextResponse.json({ user });
}
