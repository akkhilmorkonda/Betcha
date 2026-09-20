import { MEMBERS, simulateHistory } from "../src/lib/seed-data.ts";
const sim = simulateHistory();
const cats = ["grades", "sports", "dares"];
const rk = (v: Record<string, number>, k: string) =>
  Object.entries(v).sort((a, b) => b[1] - a[1]).findIndex(([x]) => x === k);

console.log("\n  name       " + cats.map((c) => c.padStart(15)).join("") + "   forecast   balance");
for (const m of MEMBERS) {
  const row = cats.map((c) => {
    const r = sim.record[m.key][c];
    return `${Math.round(sim.ratings[m.key][c])} (${r.wins}-${r.losses})`.padStart(15);
  }).join("");
  console.log("  " + m.name.padEnd(11) + row +
    String(Math.round(sim.forecast[m.key].elo)).padStart(11) +
    `$${sim.balances[m.key].toFixed(2)}`.padStart(10));
}
const byCat = (c: string) => Object.fromEntries(MEMBERS.map((m) => [m.key, sim.ratings[m.key][c]]));
const fc = Object.fromEntries(MEMBERS.map((m) => [m.key, sim.forecast[m.key].elo]));
console.log("\n  STORY CHECK");
console.log(`    akkhil best at grades   ${rk(byCat("grades"), "akkhil") === 0 ? "YES" : "no  (rank " + (rk(byCat("grades"), "akkhil") + 1) + ")"}`);
console.log(`    akkhil worst at dares   ${rk(byCat("dares"), "akkhil") === 5 ? "YES" : "no  (rank " + (rk(byCat("dares"), "akkhil") + 1) + ")"}`);
console.log(`    akkhil dares record     ${sim.record.akkhil.dares.wins}-${sim.record.akkhil.dares.losses}`);
console.log(`    dev tops forecasting    ${rk(fc, "dev") === 0 ? "YES" : "no  (rank " + (rk(fc, "dev") + 1) + ")"}`);
for (const c of cats) {
  const v = MEMBERS.map((m) => sim.ratings[m.key][c]);
  console.log(`    ${c.padEnd(8)} spread       ${Math.round(Math.max(...v) - Math.min(...v))}`);
}
console.log("");
