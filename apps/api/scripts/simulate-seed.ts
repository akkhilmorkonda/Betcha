/** Inspect the seeded circle's Elo spread before committing it to the DB. */
import { MEMBERS, simulateHistory } from "@betcha/core/src/seed-data.ts";

const { ratings, record, balances, forecast } = simulateHistory();
const cats = ["grades", "sports", "dares"];

console.log("\n  SEEDED CIRCLE — skill Elo by category\n");
console.log("  " + "name".padEnd(9) + cats.map((c) => c.padStart(16)).join("") + "    balance");
for (const m of MEMBERS) {
  const row = cats
    .map((c) => {
      const r = record[m.key][c];
      return `${Math.round(ratings[m.key][c])} (${r.wins}-${r.losses})`.padStart(16);
    })
    .join("");
  console.log("  " + m.name.padEnd(9) + row + String(Math.round(balances[m.key])).padStart(11));
}

console.log("\n  spread per category (max - min):");
for (const c of cats) {
  const vals = MEMBERS.map((m) => ratings[m.key][c]);
  console.log(`    ${c.padEnd(8)} ${Math.round(Math.min(...vals))} - ${Math.round(Math.max(...vals))}  =  ${Math.round(Math.max(...vals) - Math.min(...vals))}`);
}
console.log("\n  FORECASTING rating — how well they call OTHER people's bets\n");
console.log("  " + "name".padEnd(10) + "rating".padStart(8) + "hit rate".padStart(12) + "balance".padStart(10));
for (const m of [...MEMBERS].sort((a, b) => forecast[b.key].elo - forecast[a.key].elo)) {
  const f = forecast[m.key];
  console.log(
    "  " + m.name.padEnd(10) +
    String(Math.round(f.elo)).padStart(8) +
    `${f.hits}/${f.bets}`.padStart(12) +
    String(Math.round(balances[m.key])).padStart(10)
  );
}
console.log("");
