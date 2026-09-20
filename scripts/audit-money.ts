/** Proof the circle is closed: nothing minted, nothing destroyed. */
import { MEMBERS, STARTING_BALANCE, simulateHistory } from "../src/lib/seed-data.ts";

const sim = simulateHistory();
const start = MEMBERS.length * STARTING_BALANCE;
const end = MEMBERS.reduce((t, m) => t + sim.balances[m.key], 0);
const f = (n: number) => `$${n.toFixed(2)}`.padStart(11);

console.log(`\n  MONEY AT START   ${f(start)}`);
console.log(`  MONEY AT END     ${f(end)}`);
console.log(`  DIFFERENCE       ${f(end - start)}   ${Math.abs(end - start) < 0.01 ? "<-- closed" : "<-- STILL LEAKING"}\n`);
console.log(`  bets with backers ${sim.bets.length}`);
const totalLiab = sim.bets.reduce((t, b) => t + b.liability, 0);
const totalPnl = sim.bets.reduce((t, b) => t + b.proposerPnl, 0);
console.log(`  total posted      ${f(totalLiab)}`);
console.log(`  proposers net     ${f(totalPnl)}   (bettors net ${f(-totalPnl)})\n`);
for (const m of MEMBERS) console.log(`  ${m.name.padEnd(9)} ${f(sim.balances[m.key])}`);
console.log("");
