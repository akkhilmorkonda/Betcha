import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { betMarket } from "@/lib/bets";
import { getSessionUserId } from "@/lib/session";
import { normalizeInviteCode } from "@betcha/core";

const WEEK_MS = 7 * 86_400_000;
const RECENT_LIMIT = 8;
const LIVE_STATUSES = ["open", "pending", "voting"];

/**
 * The circle feed.
 *
 * This used to load every bet in the circle with every relation, then keep the
 * 4 that are live and the 8 most recent. Measured against the seeded circle:
 * 185 bets and 304 positions fetched to produce a 6KB response.
 *
 * It now fetches what it returns. Each query also asks for relationLoadStrategy
 * "join", because Prisma otherwise issues one round trip per relation level and
 * a hosted database charges ~30ms for each of them.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // This endpoint returns every member balance, rating and record. It once
  // required nothing but the invite code, so a code in a screenshot handed over
  // the circle finances. Membership is required; the code is only good to join.
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const circle = await prisma.circle.findUnique({
    where: { inviteCode: normalizeInviteCode(code) },
    relationLoadStrategy: "join",
    include: { memberships: { include: { user: { include: { ratings: true } } } } },
  });
  if (!circle) return NextResponse.json({ error: "No such circle" }, { status: 404 });

  // Same 404 body as a missing circle, deliberately: a non-member probing codes
  // should not be able to tell "wrong code" from "real circle, not yours".
  if (!circle.memberships.some((m) => m.userId === me)) {
    return NextResponse.json({ error: "No such circle" }, { status: 404 });
  }

  const since = new Date(Date.now() - WEEK_MS);

  const [liveBets, recentBets, resolvedCount, weekPositions] = await Promise.all([
    // Live bets carry ratings, because every one is priced on read.
    prisma.bet.findMany({
      where: { circleId: circle.id, status: { in: LIVE_STATUSES } },
      relationLoadStrategy: "join",
      include: {
        positions: { include: { user: true } },
        template: true,
        creator: true,
        subject: { include: { ratings: true } },
        opponent: { include: { ratings: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // Resolved bets need no ratings: the outcome is already known.
    prisma.bet.findMany({
      where: { circleId: circle.id, status: "resolved" },
      relationLoadStrategy: "join",
      include: { positions: { include: { user: true } }, resolution: true },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    }),

    prisma.bet.count({ where: { circleId: circle.id, status: "resolved" } }),

    // The week window is applied in SQL. It used to be a JS filter over every
    // position in the circle, which is why every one of them had to be loaded.
    prisma.position.findMany({
      where: {
        bet: { circleId: circle.id, status: "resolved", resolution: { resolvedAt: { gte: since } } },
      },
      select: { userId: true, amount: true, payout: true },
    }),
  ]);

  // Profit and loss over the last 7 days, per member, for the hero figure.
  const weekly: Record<string, number> = {};
  for (const p of weekPositions) {
    weekly[p.userId] = (weekly[p.userId] ?? 0) + ((p.payout ?? 0) - p.amount);
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

      open: liveBets.map((b) => ({
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
        // Who is in, for the social row on the feed.
        players: b.positions.map((p) => ({
          userId: p.userId,
          name: p.user.name,
          side: p.side,
          amount: p.amount,
        })),
        ...betMarket(b),
      })),
      resolvedCount,

      recent: recentBets.map((b) => {
        const winners = b.positions.filter((p) => p.side === b.resolution?.finalOutcome);
        const best = winners.sort((x, y) => (y.payout ?? 0) - (x.payout ?? 0))[0];
        return {
          id: b.id,
          title: b.title,
          category: b.category,
          outcome: b.resolution?.finalOutcome,
          method: b.resolution?.method,
          resolvedAt: b.resolution?.resolvedAt,
          topWinner: best
            ? { name: best.user.name, profit: (best.payout ?? 0) - best.amount }
            : null,
        };
      }),
    },
  });
}
