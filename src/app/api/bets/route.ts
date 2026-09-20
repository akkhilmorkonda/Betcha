import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBet, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: Request) {
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Pick a member first" }, { status: 401 });

  const body = await req.json();
  const { circleId, subjectId, category, title, templateId, opponentId, deadline, liability, proposerSide } = body;
  if (!circleId || !subjectId || !category || !title)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const bet = await createBet({
    circleId,
    creatorId: me,
    subjectId,
    category,
    title,
    templateId: templateId ?? null,
    opponentId: opponentId ?? null,
    liability: Number(liability) || undefined,
    proposerSide: proposerSide === "A" ? "A" : "B",
    sideALabel: body.sideALabel,
    sideBLabel: body.sideBLabel,
    deadline: deadline ? new Date(deadline) : new Date(Date.now() + 86_400_000),
  });

    return NextResponse.json({ bet });
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
