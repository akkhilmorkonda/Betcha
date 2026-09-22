/**
 * Search RNG seeds for a demo circle that is both legible AND on-story:
 *   - Alice clearly best at grades, clearly worst at dares
 *   - Dave tops the forecasting rating (he has the highest hidden edge)
 *   - visible spread on every dimension, no runaway balance
 */
import { MEMBERS, simulateHistory } from "../src/lib/seed-data.ts";

const cats = ["grades", "sports", "dares"];
const rank = (v: Record<string, number>, key: string) =>
  Object.entries(v).sort((a, b) => b[1] - a[1]).findIndex(([k]) => k === key);

interface Row { seed: number; score: number; g: number; d: number; sk: number; fc: number; bal: number }
const rows: Row[] = [];

for (let seed = 1; seed <= 4000; seed++) {
  const { ratings, forecast, balances } = simulateHistory(seed);

  const byCat = (c: string) =>
    Object.fromEntries(MEMBERS.map((m) => [m.key, ratings[m.key][c]]));
  const gradesRank = rank(byCat("grades"), "alice");
  const daresRank = rank(byCat("dares"), "alice");
  const fcRank = rank(
    Object.fromEntries(MEMBERS.map((m) => [m.key, forecast[m.key].elo])),
    "dave"
  );

  // Story must hold exactly, or the seed is out.
  if (gradesRank !== 0 || daresRank !== 5 || fcRank !== 0) continue;

  const spreads = cats.map((c) => {
    const v = MEMBERS.map((m) => ratings[m.key][c]);
    return Math.max(...v) - Math.min(...v);
  });
  const f = MEMBERS.map((m) => forecast[m.key].elo);
  const bals = MEMBERS.map((m) => balances[m.key]);
  const minSkill = Math.min(...spreads);
  const fcSpread = Math.max(...f) - Math.min(...f);
  const maxBal = Math.max(...bals);

  if (Math.min(...bals) < 400 || maxBal > 9000) continue;

  rows.push({
    seed,
    score: minSkill + fcSpread,
    g: Math.round(ratings.alice.grades),
    d: Math.round(ratings.alice.dares),
    sk: Math.round(minSkill),
    fc: Math.round(fcSpread),
    bal: Math.round(maxBal),
  });
}

rows.sort((a, b) => b.score - a.score);
console.log(`\n  ${rows.length} seeds satisfy the story out of 4000\n`);
console.log("  seed     alice grades   alice dares   min skill   forecast   top bal");
for (const r of rows.slice(0, 8)) {
  console.log(
    "  " + String(r.seed).padEnd(9) +
    String(r.g).padStart(13) + String(r.d).padStart(15) +
    String(r.sk).padStart(12) + String(r.fc).padStart(11) + String(r.bal).padStart(10)
  );
}
console.log("");
