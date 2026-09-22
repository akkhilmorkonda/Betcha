/** Exact state the demo circle loads with. Run before rehearsing. */
import { MEMBERS, TEMPLATES, simulateHistory } from "@betcha/core/src/seed-data.ts";
import {
  lineFor, oddsFrom, ratingUpdate, remainingCapacity, bankPnl, CENTS, type Placed,
} from "@betcha/core";
import { money } from "@betcha/core";

const sim = simulateHistory();
// Mirrors the live bets in prisma/seed.ts. side = the side the PROPOSER took.
// Money is CENTS here exactly as it is there — this file used to carry bare
// dollars, which made every figure it printed a hundredth of the real one.
const OPEN = [
  { subject: "alice", tpl: "d6", cat: "dares", proposer: "Dave", side: "B" as const, liability: 60 * CENTS },
  { subject: "alice", tpl: "d2", cat: "dares", proposer: "Erin", side: "B" as const, liability: 40 * CENTS },
  { subject: "bob", tpl: "g5", cat: "grades", proposer: "Bob", side: "A" as const, liability: 40 * CENTS, taker: "Dave", amount: 15 * CENTS },
  { subject: "carol", tpl: "s1", cat: "sports", proposer: "Carol", side: "A" as const, liability: 30 * CENTS, taker: "Erin", amount: 12 * CENTS },
];

console.log(`\n=== LIVE BETS AS SEEDED ===\n`);
for (const o of OPEN) {
  const m = MEMBERS.find((x) => x.key === o.subject)!;
  const t = TEMPLATES.find((x) => x.key === o.tpl)!;
  const subjectElo = sim.ratings[o.subject][o.cat];
  const tplElo = sim.templateElo[o.tpl];
  const odds = oddsFrom(lineFor(subjectElo, tplElo));
  const rec = sim.record[o.subject][o.cat];
  const takerSide = o.side === "A" ? "B" : "A";
  const takerMult = takerSide === "A" ? odds.multiplierA : odds.multiplierB;
  const seeded: Placed[] = o.taker
    ? [{ userId: o.taker, side: takerSide, amount: o.amount!, multiplier: takerMult }]
    : [];
  const room = remainingCapacity(seeded, takerSide, takerMult, o.liability);

  console.log(t.text.replace("{subject}", m.name));
  console.log(`  ${m.name} ${Math.round(subjectElo)} (${rec.wins}-${rec.losses})  vs  challenge ${Math.round(tplElo)}`);
  console.log(`  line ${(odds.probA * 100).toFixed(0)}%   Yes ${odds.multiplierA.toFixed(2)}x   No ${odds.multiplierB.toFixed(2)}x`);
  const sideWord = o.side === "A" ? "they'll do it" : "no chance";
  console.log(`  ${o.proposer} put up ${money(o.liability)} on "${sideWord}"`);
  console.log(o.taker
    ? `  ${o.taker} took ${money(o.amount!)} of it at ${takerMult.toFixed(2)}x`
    : `  PENDING — nobody has taken them on yet`);
  // Under $1 is a bug on an untouched bet and just "nearly full" on a live one.
  const note = room >= 1 ? "" : o.taker ? "   (nearly full)" : "   <-- BROKEN: nobody can take it";
  console.log(`  room left for takers: ${money(room)} at ${takerMult.toFixed(2)}x  ->  pays ${money(room * takerMult)}${note}`);
  console.log("");
}

console.log("=== IF THE HEADLINE DARE HITS (Alice does it) ===\n");
const aElo = sim.ratings.alice.dares;
const tElo = sim.templateElo.d6;
const odds = oddsFrom(lineFor(aElo, tElo));
const rated = sim.record.alice.dares.wins + sim.record.alice.dares.losses;
const r = ratingUpdate(aElo, tElo, true, rated);
console.log(`  Alice      ${Math.round(r.subjectBefore)} -> ${Math.round(r.subjectAfter)}   (+${Math.round(r.subjectAfter - r.subjectBefore)})`);
console.log(`  Challenge  ${Math.round(r.challengeBefore)} -> ${Math.round(r.challengeAfter)}   (${Math.round(r.challengeAfter - r.challengeBefore)})\n`);

const pushT = sim.templateElo.d2;
const pushBefore = oddsFrom(lineFor(aElo, pushT));
const pushAfter = oddsFrom(lineFor(r.subjectAfter, pushT));
console.log("  MEANWHILE the pushups bet, still open, reprices:");
console.log(`    ${pushBefore.multiplierA.toFixed(2)}x  ->  ${pushAfter.multiplierA.toFixed(2)}x`);
console.log(`    ${(pushBefore.probA * 100).toFixed(0)}%  ->  ${(pushAfter.probA * 100).toFixed(0)}%\n`);

const room = remainingCapacity([], "A", odds.multiplierA, 60 * CENTS);
const stake: Placed[] = [{ userId: "you", side: "A", amount: room, multiplier: odds.multiplierA }];
console.log(`  taking Dave on for the full ${money(room)} at ${odds.multiplierA.toFixed(2)}x:`);
console.log(`    payout   ${money(room * odds.multiplierA)}   (profit ${money(room * (odds.multiplierA - 1))})`);
console.log(`    Dave     ${money(bankPnl(stake, "A"))}  (he put up ${money(60 * CENTS)})\n`);

console.log("=== BOARDS AT LOAD ===\n");
console.log("  " + "name".padEnd(9) + "forecast".padStart(9) + "calls".padStart(9) + "balance".padStart(10));
for (const m of [...MEMBERS].sort((a, b) => sim.forecast[b.key].elo - sim.forecast[a.key].elo)) {
  const f = sim.forecast[m.key];
  console.log(
    "  " + m.name.padEnd(9) +
    String(Math.round(f.elo)).padStart(9) +
    `${f.hits}/${f.bets}`.padStart(9) +
    money(sim.balances[m.key]).padStart(10)
  );
}

console.log("\n=== VOTE ELIGIBILITY on the headline dare ===");
console.log("  out: Alice (subject), Dave (put it up), and whoever took him on");
console.log("  can vote: the remaining 3  -> 2 votes settle it\n");
