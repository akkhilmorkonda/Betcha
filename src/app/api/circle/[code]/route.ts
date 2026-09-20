import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { betMarket } from "@/lib/bets";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const circle = await prisma.circle.findUnique({
    where: { inviteCode: code.toUpperCase() },
    include: {
      memberships: { include: { user: { include: { ratings: true } } } },
      bets: {
        include: {
          positions: { include: { user: true } },
          template: true,
          creator: true,
          resolution: true,
          // Ratings come along so every open bet can be priced live.
          subject: { include: { ratings: true } },
          opponent: { include: { ratings: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!circle) return NextResponse.json({ error: "No such circle" }, { status: 404 });

  // Profit and loss over the last 7 days, per member, for the hero figure.
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekly: Record<string, number> = {};
  for (const b of circle.bets) {
    if (b.status !== "resolved") continue;
    const at = b.resolution?.resolvedAt?.getTime() ?? 0;
    if (at < weekAgo) continue;
    for (const p of b.positions) {
      weekly[p.userId] = (weekly[p.userId] ?? 0) + ((p.payout ?? 0) - p.amount);
    }
  }

  return NextResponse.json({
    circle: {
      id: circle.id,
      name: circle.name,
      inviteCode: circle.inviteCode,
      members: circle.memberships
        .map((m) => ({
          userId: m.userId,
          name: m.user.name,
          balance: m.balance,
          forecastElo: m.forecastElo,
          forecastBets: m.forecastBets,
          weeklyChange: Math.round(weekly[m.userId] ?? 0),
          ratings: Object.fromEntries(m.user.ratings.map((r) => [r.category, r.elo])),
          record: Object.fromEntries(
            m.user.ratings.map((r) => [r.category, { wins: r.wins, losses: r.losses }])
          ),
        }))
        .sort((a, b) => b.balance - a.balance),
      open: circle.bets
        .filter((b) => ["open", "pending", "voting"].includes(b.status))
        .map((b) => ({
          id: b.id,
          title: b.title,
          category: b.category,
          status: b.status,
          subject: b.subject.name,
          sideALabel: b.sideALabel,
          sideBLabel: b.sideBLabel,
          openingProbA: b.openingProbA,
          deadline: b.deadline,
          subjectId: b.subjectId,
          creator: b.creator?.name ?? null,
          proposerSide: b.proposerSide,
          // Who's in, for the social row on the feed.
          players: b.positions.map((p) => ({
            userId: p.userId,
            name: p.user.name,
            side: p.side,
            amount: p.amount,
          })),
          ...betMarket(b),
        })),
      resolvedCount: circle.bets.filter((b) => b.status === "resolved").length,
      recent: circle.bets
        .filter((b) => b.status === "resolved")
        .slice(0, 8)
        .map((b) => {
          const winners = b.positions.filter((p) => p.side === b.resolution?.finalOutcome);
          const best = winners.sort((x, y) => (y.payout ?? 0) - (x.payout ?? 0))[0];
          return {
            id: b.id,
            title: b.title,
            category: b.category,
            outcome: b.resolution?.finalOutcome,
            method: b.resolution?.method,
            resolvedAt: b.resolution?.resolvedAt,
            topWinner: best ? { name: best.user.name, profit: (best.payout ?? 0) - best.amount } : null,
          };
        }),
    },
  });
}
