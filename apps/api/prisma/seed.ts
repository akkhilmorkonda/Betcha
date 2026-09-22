/**
 * Loads the demo circle. Ratings come out of simulateHistory(), which runs a
 * hand-written history through the real engine — nothing here is typed by hand.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import {
  MEMBERS,
  TEMPLATES,
  STARTING_BALANCE,
  simulateHistory,
} from "@betcha/core/src/seed-data.ts";
import { lineFor, oddsFrom, payoutFor, CENTS } from "@betcha/core";

const prisma = new PrismaClient();
const INVITE_CODE = "HACKMIT";

// Every seeded member gets a real credential account, because the persona
// swap that used to fake identity is gone. Without this the demo circle would
// exist but be unreachable: no password, no way in.
//
// Dev fixture only. Override with SEED_PASSWORD, and never let this default
// reach an environment that has real users in it.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "betcha-dev-password";
const daysAgoDate = (d: number) => new Date(Date.now() - d * 86_400_000);

async function main() {
  console.log("Resetting…");
  await prisma.eloEvent.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.resolution.deleteMany();
  await prisma.position.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.challengeTemplate.deleteMany();
  await prisma.circle.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const sim = simulateHistory();

  const circle = await prisma.circle.create({
    data: { name: "The Group Chat", inviteCode: INVITE_CODE },
  });

  /**
   * Live bets. Each has a PROPOSER who posts what they're willing to lose --
   * that money is escrowed -- and one early taker on the other side. Both are
   * deducted from the seeded balances below, so the circle still totals $150.
   */
  const open: {
    subject: string; templateKey: string; category: string;
    proposer: string; proposerSide: "A" | "B"; liability: number;
    taker?: string; takerAmount?: number;
  }[] = [
    // THE DEMO BET, deliberately left with no taker. Dave has $60 up saying
    // Alice can't do it and nobody has taken him on — so it shows as pending,
    // and taking it live is the first move of the demo.
    //
    // This used to be `d1`, the cold plunge, cut under Guideline 1.4.5. `d6` is
    // the hardest surviving dare, so it still opens at long odds on the member
    // with the worst dares record — which is the whole point of the slot.
    { subject: "alice", templateKey: "d6", category: "dares", proposer: "dave", proposerSide: "B", liability: 60 * CENTS },
    // A SECOND dares bet on the same person, so when the first settles her
    // rating moves and this one visibly reprices on screen.
    { subject: "alice", templateKey: "d2", category: "dares", proposer: "erin", proposerSide: "B", liability: 40 * CENTS },
    // Bob and Carol both backing themselves.
    { subject: "bob", templateKey: "g5", category: "grades", proposer: "bob", proposerSide: "A", liability: 40 * CENTS, taker: "dave", takerAmount: 15 * CENTS },
    { subject: "carol", templateKey: "s1", category: "sports", proposer: "carol", proposerSide: "A", liability: 30 * CENTS, taker: "erin", takerAmount: 12 * CENTS },
  ];

  // Money locked up in live bets, per member.
  const committed: Record<string, number> = {};
  for (const o of open) {
    committed[o.proposer] = (committed[o.proposer] ?? 0) + o.liability;
    if (o.taker) committed[o.taker] = (committed[o.taker] ?? 0) + (o.takerAmount ?? 0);
  }

  // Users, memberships, ratings
  const userId: Record<string, string> = {};
  for (const m of MEMBERS) {
    const u = await prisma.user.create({
      // email is required and unique now that Better Auth shares this table.
      // .invalid is reserved by RFC 2606 and can never resolve, so seeded
      // accounts can't be mistaken for real ones or be mailed by accident —
      // but they ARE signed in as, with SEED_PASSWORD, now that the persona
      // swap is gone and a credential is the only way to become someone.
      data: {
        name: m.name,
        avatarSeed: m.key,
        email: `${m.key}@seed.invalid`,
        emailVerified: true,
      },
    });
    userId[m.key] = u.id;
    // Credential account, hashed with Better Auth's own hasher so the row is
    // byte-compatible with what a real sign-up would have written.
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: await hashPassword(SEED_PASSWORD),
      },
    });
    await prisma.membership.create({
      data: {
        userId: u.id,
        circleId: circle.id,
        balance: sim.balances[m.key] - (committed[m.key] ?? 0),
        forecastElo: Math.round(sim.forecast[m.key].elo * 10) / 10,
        forecastBets: sim.forecast[m.key].bets,
      },
    });
    for (const [category, elo] of Object.entries(sim.ratings[m.key])) {
      const rec = sim.record[m.key][category] ?? { wins: 0, losses: 0 };
      await prisma.rating.create({
        data: {
          userId: u.id,
          category,
          elo: Math.round(elo * 10) / 10,
          wins: rec.wins,
          losses: rec.losses,
        },
      });
    }
  }

  // Challenge templates, carrying the difficulty they calibrated to
  const templateId: Record<string, string> = {};
  const usage: Record<string, number> = {};
  for (const b of sim.bets) usage[b.templateKey] = (usage[b.templateKey] ?? 0) + 1;
  for (const t of TEMPLATES) {
    const c = await prisma.challengeTemplate.create({
      data: {
        category: t.category,
        text: t.text,
        difficultyElo: Math.round(sim.templateElo[t.key] * 10) / 10,
        timesUsed: usage[t.key] ?? 0,
      },
    });
    templateId[t.key] = c.id;
  }

  // Resolved history
  console.log(`Writing ${sim.bets.length} resolved bets…`);
  for (const b of sim.bets) {
    const createdAt = daysAgoDate(b.daysAgo);
    const subject = MEMBERS.find((m) => m.key === b.subjectKey)!;
    // Mix of resolution methods so the history looks lived-in.
    const method = b.index % 5 === 0 || b.index % 7 === 0 ? "vote" : "evidence";

    const bet = await prisma.bet.create({
      data: {
        circleId: circle.id,
        creatorId: userId[b.proposerKey],
        proposerSide: b.proposerSide,
        proposerLiability: b.liability,
        subjectId: userId[b.subjectKey],
        templateId: templateId[b.templateKey],
        title: b.title,
        category: b.category,
        sideALabel: `${subject.name} does it`,
        sideBLabel: `${subject.name} doesn't`,
        subjectElo: Math.round(b.subjectEloAtOpen * 10) / 10,
        difficultyElo: Math.round(b.difficultyEloAtOpen * 10) / 10,
        openingProbA: b.openingProbA,
        deadline: daysAgoDate(b.daysAgo - 1),
        resolutionDeadline: daysAgoDate(b.daysAgo - 2),
        status: "resolved",
        createdAt,
      },
    });

    for (const s of b.stakes) {
      const won = s.side === b.outcome;
      await prisma.position.create({
        data: {
          betId: bet.id,
          userId: userId[s.userKey],
          side: s.side,
          amount: s.amount,
          probAtEntry: s.prob,
          multiplierAtEntry: s.multiplier,
          balanceAtEntry: Math.round(s.balanceAtEntry),
          payout: won ? payoutFor(s.amount, s.multiplier) : 0,
          createdAt,
        },
      });
    }

    await prisma.resolution.create({
      data: {
        betId: bet.id,
        method,
        finalOutcome: b.outcome,
        sparkClaim:
          method === "evidence" ? "Photo showed the completed attempt." : null,
        sparkConfidence: method === "evidence" ? 0.88 : null,
        resolvedAt: daysAgoDate(b.daysAgo - 2),
      },
    });

    await prisma.eloEvent.create({
      data: {
        betId: bet.id,
        userId: userId[b.subjectKey],
        category: b.category,
        before: Math.round(b.subjectEloAtOpen * 10) / 10,
        after: Math.round(sim.ratings[b.subjectKey][b.category] * 10) / 10,
        createdAt: daysAgoDate(b.daysAgo - 2),
      },
    });
  }

  for (const o of open) {
    const t = TEMPLATES.find((x) => x.key === o.templateKey)!;
    const subject = MEMBERS.find((m) => m.key === o.subject)!;
    const subjectElo = sim.ratings[o.subject][o.category];
    const difficultyElo = sim.templateElo[o.templateKey];
    const line = lineFor(subjectElo, difficultyElo);
    const odds = oddsFrom(line);

    const bet = await prisma.bet.create({
      data: {
        circleId: circle.id,
        creatorId: userId[o.proposer],
        proposerSide: o.proposerSide,
        proposerLiability: o.liability,
        subjectId: userId[o.subject],
        templateId: templateId[o.templateKey],
        title: t.text.replace("{subject}", subject.name),
        category: o.category,
        sideALabel: `${subject.name} does it`,
        sideBLabel: `${subject.name} doesn't`,
        subjectElo: Math.round(subjectElo * 10) / 10,
        difficultyElo: Math.round(difficultyElo * 10) / 10,
        openingProbA: line,
        deadline: new Date(Date.now() + 2 * 86_400_000),
        resolutionDeadline: new Date(Date.now() + 3 * 86_400_000),
        // Not live until somebody takes the other side.
        status: o.taker ? "open" : "pending",
      },
    });

    // Whoever took them on. Always the opposite side to the proposer.
    if (o.taker) {
      const takerSide = o.proposerSide === "A" ? "B" : "A";
      await prisma.position.create({
        data: {
          betId: bet.id,
          userId: userId[o.taker],
          side: takerSide,
          amount: o.takerAmount!,
          probAtEntry: takerSide === "A" ? line : 1 - line,
          multiplierAtEntry: takerSide === "A" ? odds.multiplierA : odds.multiplierB,
          balanceAtEntry: Math.round(sim.balances[o.taker]),
        },
      });
    }
  }

  const fc = [...MEMBERS].sort((a, b) => sim.forecast[b.key].elo - sim.forecast[a.key].elo);
  console.log(
    `  sharpest caller: ${fc[0].name} (${Math.round(sim.forecast[fc[0].key].elo)})  ` +
    `worst: ${fc[fc.length - 1].name} (${Math.round(sim.forecast[fc[fc.length - 1].key].elo)})`
  );

  const counts = {
    members: MEMBERS.length,
    templates: TEMPLATES.length,
    resolved: sim.bets.length,
    open: open.length,
  };
  console.log(
    `\nSeeded "${circle.name}"  invite code ${INVITE_CODE}\n` +
      `  ${counts.members} members · ${counts.templates} challenge templates\n` +
      `  ${counts.resolved} resolved bets · ${counts.open} open\n`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
