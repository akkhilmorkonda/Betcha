import { NextResponse } from "next/server";
import { castVote, BetError } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";
import { readBody, rateLimit } from "@/lib/guard";
import { castVoteBody } from "@/lib/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit(req, me, "castVote");
  if (limited) return limited;

  // `side` used to go straight from the body into a Vote row unchecked.
  const body = await readBody(req, castVoteBody);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json(await castVote(id, me, body.data.side));
  } catch (e) {
    if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
