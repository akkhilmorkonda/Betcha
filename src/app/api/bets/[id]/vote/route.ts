import { NextResponse } from "next/server";
import { castVote, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Pick a member first" }, { status: 401 });

  const { side } = await req.json();
  try {
    return NextResponse.json(await castVote(id, me, side));
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
