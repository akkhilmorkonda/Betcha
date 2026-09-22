import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { betMarket, eligibleVoterIds } from "@/lib/bets";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bet = await prisma.bet.findUnique({
    where: { id },
    include: {
      positions: { include: { user: true } },
      subject: { include: { ratings: true } },
      opponent: { include: { ratings: true } },
      creator: true,
      template: true,
      resolution: { include: { votes: { include: { user: true } } } },
      eloEvents: true,
      circle: { include: { memberships: { include: { user: true } } } },
    },
  });
  if (!bet) return NextResponse.json({ error: "No such bet" }, { status: 404 });

  // Whoever tops the forecasting rating wears the badge on their positions.
  const sharpest = [...bet.circle.memberships].sort((a, b) => b.forecastElo - a.forecastElo)[0];

  const subjectRating = bet.subject.ratings.find((r) => r.category === bet.category);

  return NextResponse.json({
    bet: {
      id: bet.id,
      circleCode: bet.circle.inviteCode,
      title: bet.title,
      category: bet.category,
      status: bet.status,
      sideALabel: bet.sideALabel,
      sideBLabel: bet.sideBLabel,
      deadline: bet.deadline,
      openingProbA: bet.openingProbA,
      subjectId: bet.subjectId,
      subject: { id: bet.subject.id, name: bet.subject.name },
      creatorId: bet.creatorId,
      creator: { id: bet.creator.id, name: bet.creator.name },
      // proposerSide comes from the ...betMarket(bet) spread below, which
      // narrows it to Side. Setting it here too just got overwritten.
      opponent: bet.opponent ? { id: bet.opponent.id, name: bet.opponent.name } : null,
      template: bet.template ? { text: bet.template.text, timesUsed: bet.template.timesUsed } : null,
      // Plain-language backing for the "why this price" disclosure.
      subjectRecord: subjectRating ? { wins: subjectRating.wins, losses: subjectRating.losses } : null,
      sharpestUserId: sharpest?.userId ?? null,
      positions: bet.positions.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        side: p.side,
        amount: p.amount,
        multiplierAtEntry: p.multiplierAtEntry,
        payout: p.payout,
      })),
      resolution: bet.resolution,
      eloEvents: bet.eloEvents,
      ...betMarket(bet),
      eligibleVoters: bet.status === "voting" ? await eligibleVoterIds(id) : [],
    },
  });
}
