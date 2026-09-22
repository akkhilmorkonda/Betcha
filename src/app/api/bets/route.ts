import { NextResponse } from "next/server";
import { createBet, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";
import { readBody, rateLimit } from "@/lib/guard";
import { createBetBody } from "@/lib/schemas";

const DAY_MS = 86_400_000;

export async function POST(req: Request) {
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit(req, me, "createBet");
  if (limited) return limited;

  // Every field used to be pulled off an unvalidated body and forwarded: an
  // unknown category, a 10MB title or a NaN liability all reached the engine.
  const body = await readBody(req, createBetBody);
  if (!body.ok) return body.response;
  const b = body.data;

  try {
    const bet = await createBet({
      circleId: b.circleId,
      creatorId: me,
      subjectId: b.subjectId,
      category: b.category,
      title: b.title,
      templateId: b.templateId ?? null,
      opponentId: b.opponentId ?? null,
      liability: b.liability,
      proposerSide: b.proposerSide ?? "B",
      sideALabel: b.sideALabel,
      sideBLabel: b.sideBLabel,
      deadline: b.deadline ?? new Date(Date.now() + DAY_MS),
    });
    return NextResponse.json({ bet });
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
