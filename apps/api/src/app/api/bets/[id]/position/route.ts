import { NextResponse } from "next/server";
import { placePosition, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";
import { readBody, rateLimit } from "@/lib/guard";
import { placePositionBody } from "@betcha/core";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit(req, me, "placePosition");
  if (limited) return limited;

  // amount was Number(amount) — NaN for anything unparseable, which then flowed
  // into the balance arithmetic.
  const body = await readBody(req, placePositionBody);
  if (!body.ok) return body.response;

  try {
    await placePosition({
      betId: id,
      userId: me,
      side: body.data.side,
      amount: body.data.amount,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
