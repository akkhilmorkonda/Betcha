import { NextResponse } from "next/server";
import { placePosition, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Pick a member first" }, { status: 401 });

  const { side, amount } = await req.json();
  if (side !== "A" && side !== "B")
    return NextResponse.json({ error: "Side must be A or B" }, { status: 400 });

  try {
    await placePosition({ betId: id, userId: me, side, amount: Number(amount) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
