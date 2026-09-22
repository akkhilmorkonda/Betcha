/** Find sim settings + seed that land every balance inside a target range. */
import { MEMBERS, simulateHistory } from "../src/lib/seed-data.ts";

const LO = 50, HI = 200;
const cats = ["grades", "sports", "dares"];
const rk = (v: Record<string, number>, k: string) =>
  Object.entries(v).sort((a, b) => b[1] - a[1]).findIndex(([x]) => x === k);

interface Hit { start: number; sf: number; lf: number; seed: number; lo: number; hi: number; sk: number; fc: number; bets: number }
const hits: Hit[] = [];

for (const start of [100, 110, 120]) {
  for (const sf of [0.05, 0.07, 0.09]) {
    for (const lf of [0.12, 0.18]) {
      const opts = {
        start,
        maxStake: Math.round(start * 0.22),
        maxLiability: Math.round(start * 0.3),
        stakeFraction: sf,
        liabilityFraction: lf,
      };
      for (let seed = 1; seed <= 1200; seed++) {
        const sim = simulateHistory(seed, opts);
        const bals = MEMBERS.map((m) => sim.balances[m.key]);
        const lo = Math.min(...bals), hi = Math.max(...bals);
        if (lo < LO || hi > HI) continue;
        if (sim.bets.length < 110) continue;

        const byCat = (c: string) => Object.fromEntries(MEMBERS.map((m) => [m.key, sim.ratings[m.key][c]]));
        const fc = Object.fromEntries(MEMBERS.map((m) => [m.key, sim.forecast[m.key].elo]));
        if (rk(byCat("grades"), "alice") !== 0) continue;
        if (rk(byCat("dares"), "alice") !== 5) continue;
        if (sim.record.alice.dares.wins !== 0) continue;
        if (rk(fc, "dave") !== 0) continue;

        const spreads = cats.map((c) => {
          const v = MEMBERS.map((m) => sim.ratings[m.key][c]);
          return Math.max(...v) - Math.min(...v);
        });
        const f = MEMBERS.map((m) => fc[m.key]);
        hits.push({
          start, sf, lf, seed,
          lo: Math.round(lo), hi: Math.round(hi),
          sk: Math.round(Math.min(...spreads)),
          fc: Math.round(Math.max(...f) - Math.min(...f)),
          bets: sim.bets.length,
        });
      }
    }
  }
}

hits.sort((a, b) => (b.sk + b.fc) - (a.sk + a.fc));
console.log(`\n  ${hits.length} combinations land every balance in $${LO}-$${HI} and hold the story\n`);
console.log("  start  stakeFrac  liabFrac   seed    low    high   skill  forecast  bets");
for (const h of hits.slice(0, 10)) {
  console.log(`  ${String(h.start).padEnd(7)}${String(h.sf).padEnd(11)}${String(h.lf).padEnd(10)}${String(h.seed).padEnd(8)}$${String(h.lo).padEnd(6)}$${String(h.hi).padEnd(7)}${String(h.sk).padStart(5)}${String(h.fc).padStart(10)}${String(h.bets).padStart(6)}`);
}
console.log("");
