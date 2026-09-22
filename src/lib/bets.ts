/**
 * Bet business logic. Routes stay thin so this stays testable.
 *
 * Pricing is a pure function of current ratings — see market.ts. Nothing here
 * lets stake size touch the line.
 */
import { prisma } from "./db";
import { money } from "./format";
import {
  DEFAULT_ELO,
  DEFAULT_LIABILITY,
  MIN_LIABILITY,
  MAX_LIABILITY,
  MIN_STAKE,
  minBackingFor,
  lineFor,
  oddsFrom,
  settleFixed,
  bankPnl,
  worstCaseExposure,
  remainingCapacity,
  ratingUpdate,
  headToHeadUpdate,
  forecastUpdate,
  type Odds,
  type Placed,
  type Side,
} from "./market";
import {
  selfDeal,
  startVoteRefusal,
  startVoteRefusalMessage,
  type StartVoteRefusal,
} from "./eligibility";
import {
  reviewTitle,
  templateRefusal,
  templateRefusalMessage,
  isTemplateOnly,
} from "./moderation";

export class BetError extends Error {}

export async function ratingFor(userId: string, category: string) {
  const existing = await prisma.rating.findUnique({
    where: { userId_category: { userId, category } },
  });
  if (existing) return existing;
  return prisma.rating.create({ data: { userId, category, elo: DEFAULT_ELO } });
}

const eloIn = (ratings: { category: string; elo: number }[] | undefined, category: string) =>
  ratings?.find((r) => r.category === category)?.elo ?? DEFAULT_ELO;

/** What a bet needs to be priced. Ratings are read live, never cached on the bet. */
export interface PriceableBet {
  category: string;
  difficultyElo: number;
  subject?: { ratings?: { category: string; elo: number }[] } | null;
  opponent?: { ratings?: { category: string; elo: number }[] } | null;
  template?: { difficultyElo: number } | null;
  positions?: { side: string; amount: number; multiplierAtEntry: number }[];
  proposerLiability?: number;
  proposerSide?: string;
}

export function currentRatings(bet: PriceableBet) {
  const subjectElo = eloIn(bet.subject?.ratings, bet.category);
  const difficultyElo = bet.opponent
    ? eloIn(bet.opponent.ratings, bet.category)
    : bet.template
      ? bet.template.difficultyElo
      : bet.difficultyElo;
  return { subjectElo, difficultyElo };
}

export function betOdds(bet: PriceableBet): Odds {
  const { subjectElo, difficultyElo } = currentRatings(bet);
  return oddsFrom(lineFor(subjectElo, difficultyElo));
}

const placedFrom = (positions: PriceableBet["positions"] = []): Placed[] =>
  positions.map((p) => ({
    userId: "",
    side: p.side as Side,
    amount: p.amount,
    multiplier: p.multiplierAtEntry,
  }));

/** Live market view: the Elo price, plus how much room the bank has left. */
export function betMarket(bet: PriceableBet) {
  const odds = betOdds(bet);
  const { subjectElo, difficultyElo } = currentRatings(bet);
  const placed = placedFrom(bet.positions);
  const staked = placed.reduce((t, p) => t + p.amount, 0);
  const liability = bet.proposerLiability ?? DEFAULT_LIABILITY;
  const proposerSide: Side = (bet.proposerSide as Side) ?? "B";
  const takerSide: Side = proposerSide === "A" ? "B" : "A";
  return {
    ...odds,
    proposerSide,
    takerSide,
    subjectEloNow: subjectElo,
    difficultyEloNow: difficultyElo,
    staked,
    exposure: worstCaseExposure(placed),
    liability,
    // What's left of the proposer's stake on each side.
    capacityA: remainingCapacity(placed, "A", odds.multiplierA, liability),
    capacityB: remainingCapacity(placed, "B", odds.multiplierB, liability),
  };
}

export async function createBet(input: {
  circleId: string;
  creatorId: string;
  subjectId: string;
  category: string;
  title: string;
  sideALabel?: string;
  sideBLabel?: string;
  templateId?: string | null;
  opponentId?: string | null;
  deadline: Date;
  /** Which side the proposer is on. Everyone else must take the other. */
  proposerSide?: Side;
  /** What the proposer is willing to lose. Escrowed from their balance. */
  liability?: number;
}) {
  const liability = Math.min(
    MAX_LIABILITY,
    Math.max(MIN_LIABILITY, Math.round(input.liability ?? DEFAULT_LIABILITY))
  );

  // A head-to-head against yourself has no coherent pair of sides, and it puts
  // eligibility.ts in the position of having to pick which rule wins. Refuse it
  // at the source instead.
  if (input.opponentId && input.opponentId === input.subjectId)
    throw new BetError("Pick someone else — a head-to-head needs two people");

  // `dares` is template-only at launch — see moderation.ts. The schema refuses
  // a dare with no templateId at the boundary; this is the same rule at the
  // engine, because createBet is also reachable from scripts and from any route
  // added later, and a rule that lives only in a zod schema is a rule one
  // forgotten import removes.
  const missingTemplate = templateRefusal({
    category: input.category,
    templateId: input.templateId,
  });
  if (missingTemplate) throw new BetError(templateRefusalMessage(missingTemplate));

  const backer = await prisma.membership.findUnique({
    where: { userId_circleId: { userId: input.creatorId, circleId: input.circleId } },
  });
  if (!backer) throw new BetError("You're not in this circle");

  // The subject and opponent must be in this circle too. Only the creator was
  // ever checked, so a bet could be opened about someone who isn't a member —
  // and it would then be unresolvable, because resolveBet settles ratings and
  // balances through their Membership row, which doesn't exist.
  const subjectMembership = await prisma.membership.findUnique({
    where: { userId_circleId: { userId: input.subjectId, circleId: input.circleId } },
  });
  if (!subjectMembership) throw new BetError("That person isn't in this circle");
  if (input.opponentId) {
    const opponentMembership = await prisma.membership.findUnique({
      where: { userId_circleId: { userId: input.opponentId, circleId: input.circleId } },
    });
    if (!opponentMembership) throw new BetError("Their opponent isn't in this circle");
  }
  if (backer.balance < liability)
    throw new BetError(
      `You're backing this with ${money(liability)}, but you only have ${money(backer.balance)}`
    );

  const subjectRating = await ratingFor(input.subjectId, input.category);

  // Load the template whenever one is named, not only when it happens to price
  // the bet. For a template-only category the row IS the vetted proposition, so
  // it has to exist and it has to be in the same category — otherwise the rule
  // is bypassed by pointing a `dares` bet at a `grades` template id and riding
  // the free-text title in alongside it. A head-to-head dare names a template
  // too, even though the opponent's rating is what prices it.
  const template = input.templateId
    ? await prisma.challengeTemplate.findUnique({ where: { id: input.templateId } })
    : null;
  const badTemplate = templateRefusal({
    category: input.category,
    templateId: input.templateId,
    templateCategory: template?.category ?? null,
  });
  if (badTemplate) throw new BetError(templateRefusalMessage(badTemplate));

  let difficultyElo: number;
  if (input.opponentId) {
    difficultyElo = (await ratingFor(input.opponentId, input.category)).elo;
  } else {
    difficultyElo = template?.difficultyElo ?? DEFAULT_ELO;
  }

  const line = lineFor(subjectRating.elo, difficultyElo);
  const odds = oddsFrom(line);
  const side: Side = input.proposerSide ?? "B";
  const takerMultiplier = side === "A" ? odds.multiplierB : odds.multiplierA;

  // A backing too small to absorb even the minimum stake makes a bet that
  // nobody can take. Don't let one be created.
  const needed = minBackingFor(takerMultiplier);
  if (liability < needed) {
    throw new BetError(
      `At ${takerMultiplier.toFixed(2)}x you'd need to put up at least ${money(needed)} ` +
        `for anyone to bet ${money(MIN_STAKE)}. ${money(liability)} only covers ` +
        `${money(Math.floor(liability / (takerMultiplier - 1)))}.`
    );
  }

  // CONTENT SAFETY, check one of two. The free text a member wrote — the title
  // and both side labels, because all three are published to the circle and all
  // three are part of the proposition. Last thing before anything is written,
  // so a refused bet leaves no row and no escrowed money behind.
  //
  // With no OPENAI_API_KEY this runs the offline written policy only and comes
  // back `reviewed: false`; with a key configured and the call failing it
  // refuses. See the header of moderation.ts for why those differ.
  const review = await reviewTitle({
    text: [input.title, input.sideALabel, input.sideBLabel]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(" / "),
  });
  if (review.decision === "refuse") throw new BetError(review.reason);

  const subject = await prisma.user.findUnique({ where: { id: input.subjectId } });

  // Lock the backing away so it can't be spent elsewhere while the bet is live.
  await prisma.membership.update({
    where: { id: backer.id },
    data: { balance: { decrement: liability } },
  });

  return prisma.bet.create({
    data: {
      circleId: input.circleId,
      creatorId: input.creatorId,
      subjectId: input.subjectId,
      opponentId: input.opponentId ?? null,
      templateId: input.templateId ?? null,
      title: input.title,
      category: input.category,
      sideALabel: input.sideALabel || `${subject?.name ?? "They"} does it`,
      sideBLabel: input.sideBLabel || `${subject?.name ?? "They"} doesn't`,
      // Snapshot of what the line was at creation, for the "opened at" marker.
      proposerSide: side,
      proposerLiability: liability,
      // Nothing is at risk until somebody takes them on.
      status: "pending",
      subjectElo: subjectRating.elo,
      difficultyElo,
      openingProbA: line,
      deadline: input.deadline,
      resolutionDeadline: new Date(input.deadline.getTime() + 86_400_000),
    },
  });
}

export async function placePosition(input: {
  betId: string;
  userId: string;
  side: Side;
  amount: number;
}) {
  const bet = await prisma.bet.findUnique({
    where: { id: input.betId },
    include: {
      positions: true,
      template: true,
      subject: { include: { ratings: true } },
      opponent: { include: { ratings: true } },
    },
  });
  if (!bet) throw new BetError("Bet not found");
  if (bet.status !== "open" && bet.status !== "pending")
    throw new BetError("This bet is closed");

  const takerSide: Side = bet.proposerSide === "A" ? "B" : "A";
  if (input.side !== takerSide) {
    const who = bet.proposerSide === "A" ? bet.sideALabel : bet.sideBLabel;
    throw new BetError(`Whoever put this up already has "${who}" — you can only take the other side`);
  }
  if (!Number.isInteger(input.amount))
    throw new BetError("Stake must be a whole number of cents");
  if (input.amount <= 0) throw new BetError("Stake must be positive");
  if (input.amount < MIN_STAKE)
    throw new BetError(`The smallest stake is ${money(MIN_STAKE)}`);
  if (new Date() > bet.deadline) throw new BetError("Past the deadline");

  // Nobody may profit from their own failure. See src/lib/eligibility.ts for
  // why, and tests/eligibility.test.ts for the invariant.
  switch (
    selfDeal({
      userId: input.userId,
      side: input.side,
      subjectId: bet.subjectId,
      opponentId: bet.opponentId,
    })
  ) {
    case "subject-against-self":
      throw new BetError("This bet is about you — you can only back yourself to do it");
    case "opponent-against-self":
      throw new BetError("You're the opponent here — you can only back yourself to win");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_circleId: { userId: input.userId, circleId: bet.circleId } },
  });
  if (!membership) throw new BetError("You're not in this circle");
  if (membership.balance < input.amount) throw new BetError("Not enough balance");
  if (bet.positions.some((p) => p.userId === input.userId))
    throw new BetError("You already have a position on this bet");
  if (bet.creatorId === input.userId)
    throw new BetError("You're backing this bet — you're already on the other side");

  // Re-read and re-check INSIDE the transaction. Two people taking the same bet
  // at the same moment would otherwise both see the same free capacity and both
  // pass, together pushing the proposer past what they agreed to lose.
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.bet.findUnique({
      where: { id: input.betId },
      include: {
        positions: true,
        template: true,
        subject: { include: { ratings: true } },
        opponent: { include: { ratings: true } },
      },
    });
    if (!fresh) throw new BetError("Bet not found");
    if (fresh.status !== "open" && fresh.status !== "pending")
      throw new BetError("This bet just closed");
    if (fresh.positions.some((p) => p.userId === input.userId))
      throw new BetError("You already have a position on this bet");

    const market = betMarket(fresh);
    const multiplier = input.side === "A" ? market.multiplierA : market.multiplierB;
    const capacity = input.side === "A" ? market.capacityA : market.capacityB;

    if (input.amount > capacity) {
      // "Fully covered" is only true if people actually filled it. On an
      // untouched bet the real problem is that the backing is too small.
      const untouched = fresh.positions.length === 0;
      throw new BetError(
        untouched
          ? `The ${money(fresh.proposerLiability)} behind this only covers ${money(capacity)} at ${multiplier.toFixed(2)}x — too small to bet against`
          : capacity < MIN_STAKE
            ? "This bet is fully covered — nothing left to take"
            : `Only ${money(capacity)} left on this bet`
      );
    }

    await tx.membership.update({
      where: { id: membership.id },
      data: { balance: { decrement: input.amount } },
    });
    await tx.position.create({
      data: {
        betId: fresh.id,
        userId: input.userId,
        side: input.side,
        amount: input.amount,
        probAtEntry: input.side === "A" ? market.probA : market.probB,
        multiplierAtEntry: multiplier, // locked, like taking a price at a book
        balanceAtEntry: membership.balance, // before the stake comes out
      },
    });
    // The first taker is what makes the bet live.
    await tx.bet.update({ where: { id: fresh.id }, data: { status: "open" } });

    return { multiplier, wentLive: fresh.status === "pending" };
  });
}

/** Settles a bet, pays winners at their locked price, moves ratings. */
export async function resolveBet(input: {
  betId: string;
  outcome: Side;
  method: "evidence" | "vote";
  evidenceUrl?: string | null;
  sparkClaim?: string | null;
  sparkConfidence?: number | null;
}) {
  const bet = await prisma.bet.findUnique({
    where: { id: input.betId },
    include: { positions: true },
  });
  if (!bet) throw new BetError("Bet not found");
  if (bet.status === "resolved") throw new BetError("Already resolved");

  const placed: Placed[] = bet.positions.map((p) => ({
    userId: p.userId,
    side: p.side as Side,
    amount: p.amount,
    multiplier: p.multiplierAtEntry,
  }));
  const result = settleFixed(placed, input.outcome);
  const payoutByUser = new Map(result.payouts.map((p) => [p.userId, p.payout]));

  // Everything a bettor wins comes out of the proposer's escrow, so the
  // circle's total is unchanged by settling. result.bankPnl IS the proposer's
  // profit or loss.
  const proposerReturn = bet.proposerLiability + result.bankPnl;

  // The cap is enforced when positions are placed, so this should be
  // unreachable. If it ever fires, something let a bet exceed its backing and
  // settling would mint money — fail loudly instead of paying it out.
  if (proposerReturn < -1e-6) {
    throw new BetError(
      `Refusing to settle: payout would exceed the ${bet.proposerLiability} backing this bet`
    );
  }

  const subjectRating = await ratingFor(bet.subjectId, bet.category);
  const subjectWon = input.outcome === "A";
  const ratedBets = subjectRating.wins + subjectRating.losses;
  const ops: any[] = [];

  // Everyone who took a side gets their forecasting rating moved, weighted by
  // how much of their bankroll they put behind the call. Stake size scales the
  // rating; it never scaled the price.
  const memberships = await prisma.membership.findMany({
    where: { circleId: bet.circleId, userId: { in: bet.positions.map((p) => p.userId) } },
  });
  const membershipBy = new Map(memberships.map((m) => [m.userId, m]));

  for (const p of bet.positions) {
    const payout = payoutByUser.get(p.userId) ?? 0;
    ops.push(prisma.position.update({ where: { id: p.id }, data: { payout } }));

    const m = membershipBy.get(p.userId);
    if (m) {
      const fc = forecastUpdate(
        m.forecastElo,
        p.probAtEntry,
        p.side === input.outcome,
        p.amount,
        p.balanceAtEntry || m.balance + p.amount
      );
      ops.push(
        prisma.membership.update({
          where: { id: m.id },
          data: {
            balance: payout > 0 ? { increment: payout } : undefined,
            forecastElo: fc.after,
            forecastBets: { increment: 1 },
          },
        })
      );
    } else if (payout > 0) {
      ops.push(
        prisma.membership.update({
          where: { userId_circleId: { userId: p.userId, circleId: bet.circleId } },
          data: { balance: { increment: payout } },
        })
      );
    }
  }

  if (bet.opponentId) {
    const opponentRating = await ratingFor(bet.opponentId, bet.category);
    const h2h = headToHeadUpdate(subjectRating.elo, opponentRating.elo, subjectWon);
    ops.push(
      prisma.rating.update({
        where: { id: subjectRating.id },
        data: {
          elo: h2h.aAfter,
          wins: { increment: subjectWon ? 1 : 0 },
          losses: { increment: subjectWon ? 0 : 1 },
        },
      }),
      prisma.rating.update({
        where: { id: opponentRating.id },
        data: {
          elo: h2h.bAfter,
          wins: { increment: subjectWon ? 0 : 1 },
          losses: { increment: subjectWon ? 1 : 0 },
        },
      }),
      prisma.eloEvent.create({
        data: {
          betId: bet.id,
          userId: bet.subjectId,
          category: bet.category,
          before: subjectRating.elo,
          after: h2h.aAfter,
        },
      }),
      prisma.eloEvent.create({
        data: {
          betId: bet.id,
          userId: bet.opponentId,
          category: bet.category,
          before: opponentRating.elo,
          after: h2h.bAfter,
        },
      })
    );
  } else {
    const template = bet.templateId
      ? await prisma.challengeTemplate.findUnique({ where: { id: bet.templateId } })
      : null;
    const difficultyNow = template?.difficultyElo ?? bet.difficultyElo;
    const upd = ratingUpdate(subjectRating.elo, difficultyNow, subjectWon, ratedBets);
    ops.push(
      prisma.rating.update({
        where: { id: subjectRating.id },
        data: {
          elo: upd.subjectAfter,
          wins: { increment: subjectWon ? 1 : 0 },
          losses: { increment: subjectWon ? 0 : 1 },
        },
      }),
      prisma.eloEvent.create({
        data: {
          betId: bet.id,
          userId: bet.subjectId,
          category: bet.category,
          before: subjectRating.elo,
          after: upd.subjectAfter,
        },
      })
    );
    if (bet.templateId) {
      ops.push(
        prisma.challengeTemplate.update({
          where: { id: bet.templateId },
          data: { difficultyElo: upd.challengeAfter, timesUsed: { increment: 1 } },
        }),
        prisma.eloEvent.create({
          data: {
            betId: bet.id,
            templateId: bet.templateId,
            category: bet.category,
            before: upd.challengeBefore,
            after: upd.challengeAfter,
          },
        })
      );
    }
  }

  ops.push(
    prisma.membership.update({
      where: { userId_circleId: { userId: bet.creatorId, circleId: bet.circleId } },
      data: { balance: { increment: proposerReturn } },
    })
  );

  ops.push(
    prisma.resolution.upsert({
      where: { betId: bet.id },
      create: {
        betId: bet.id,
        method: input.method,
        finalOutcome: input.outcome,
        evidenceUrl: input.evidenceUrl ?? null,
        sparkClaim: input.sparkClaim ?? null,
        sparkConfidence: input.sparkConfidence ?? null,
      },
      update: {
        method: input.method,
        finalOutcome: input.outcome,
        evidenceUrl: input.evidenceUrl ?? null,
        sparkClaim: input.sparkClaim ?? null,
        sparkConfidence: input.sparkConfidence ?? null,
        resolvedAt: new Date(),
      },
    }),
    prisma.bet.update({ where: { id: bet.id }, data: { status: "resolved" } })
  );

  await prisma.$transaction(ops);
  return { settlement: result, outcome: input.outcome };
}

/** Nobody took it on. Refund the proposer's escrow, nothing changes hands. */
export async function voidBet(betId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { positions: true },
  });
  if (!bet) throw new BetError("Bet not found");
  if (bet.positions.length > 0)
    throw new BetError("Someone already took this on — it has to be settled, not voided");
  if (bet.status === "resolved" || bet.status === "void")
    throw new BetError("Already finished");

  await prisma.$transaction([
    prisma.membership.update({
      where: { userId_circleId: { userId: bet.creatorId, circleId: bet.circleId } },
      data: { balance: { increment: bet.proposerLiability } },
    }),
    prisma.bet.update({ where: { id: betId }, data: { status: "void" } }),
  ]);
  return { refunded: bet.proposerLiability };
}

export class StartVoteError extends BetError {
  constructor(
    message: string,
    readonly refusal: Exclude<StartVoteRefusal, null>
  ) {
    super(message);
  }
}

/**
 * Drop a bet to a circle vote.
 *
 * `by` is the member asking for it. It is required, not optional, precisely
 * because it used to be absent: startVote took a bet id and did as it was told,
 * so any member could force an open bet to a vote before its deadline and take
 * the subject's remaining time away. The rule is `startVoteRefusal` in
 * eligibility.ts — pure, fuzzed, and the place to read about who may end a bet
 * early and why the proposer is not one of them.
 */
export async function startVote(
  betId: string,
  by: { userId: string; isCircleMember: boolean },
  meta?: { evidenceUrl?: string | null; sparkClaim?: string | null; sparkConfidence?: number | null },
  now: Date = new Date()
) {
  const bet = await prisma.bet.findUnique({ where: { id: betId } });
  if (!bet) throw new BetError("Bet not found");

  const refusal = startVoteRefusal({
    isCircleMember: by.isCircleMember,
    isSubject: by.userId === bet.subjectId,
    betStatus: bet.status,
    deadline: bet.deadline.getTime(),
    now: now.getTime(),
  });
  if (refusal) throw new StartVoteError(startVoteRefusalMessage(refusal), refusal);

  await prisma.resolution.upsert({
    where: { betId },
    create: {
      betId,
      method: "vote",
      finalOutcome: "pending",
      evidenceUrl: meta?.evidenceUrl ?? null,
      sparkClaim: meta?.sparkClaim ?? null,
      sparkConfidence: meta?.sparkConfidence ?? null,
    },
    update: {
      method: "vote",
      evidenceUrl: meta?.evidenceUrl ?? null,
      sparkClaim: meta?.sparkClaim ?? null,
      sparkConfidence: meta?.sparkConfidence ?? null,
    },
  });
  return prisma.bet.update({ where: { id: betId }, data: { status: "voting" } });
}

/**
 * Members with no stake in the outcome. That now excludes the PROPOSER: they
 * back the bet with their own money and are the counterparty to every position,
 * so they have the largest interest of anyone.
 */
export async function eligibleVoterIds(betId: string): Promise<string[]> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { positions: true, circle: { include: { memberships: true } } },
  });
  if (!bet) return [];
  const involved = new Set<string>([
    ...bet.positions.map((p) => p.userId),
    bet.subjectId,
    bet.creatorId, // backs it with their own money
  ]);
  if (bet.opponentId) involved.add(bet.opponentId);
  return bet.circle.memberships.map((m) => m.userId).filter((id) => !involved.has(id));
}

export async function castVote(betId: string, userId: string, side: Side) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { resolution: true },
  });
  if (!bet || !bet.resolution || bet.status !== "voting")
    throw new BetError("This bet isn't in a vote");

  const eligible = await eligibleVoterIds(betId);
  if (!eligible.includes(userId))
    throw new BetError("You have a stake in this bet, so you can't vote on it");

  await prisma.vote.upsert({
    where: { resolutionId_userId: { resolutionId: bet.resolution.id, userId } },
    create: { resolutionId: bet.resolution.id, userId, side },
    update: { side },
  });

  const votes = await prisma.vote.findMany({ where: { resolutionId: bet.resolution.id } });
  const a = votes.filter((v) => v.side === "A").length;
  const b = votes.filter((v) => v.side === "B").length;
  // Majority of everyone eligible, not just of votes cast.
  const needed = Math.floor(eligible.length / 2) + 1;

  if (a >= needed || b >= needed) {
    await resolveBet({
      betId,
      outcome: a >= needed ? "A" : "B",
      method: "vote",
      evidenceUrl: bet.resolution.evidenceUrl,
      sparkClaim: bet.resolution.sparkClaim,
      sparkConfidence: bet.resolution.sparkConfidence,
    });
    return { resolved: true, tally: { a, b }, needed, eligible: eligible.length };
  }
  return { resolved: false, tally: { a, b }, needed, eligible: eligible.length };
}
