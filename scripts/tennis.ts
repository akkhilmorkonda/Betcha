/** Alice's worked example, through the real engine. */
import { lineFor, oddsFrom, settleFixed, bankPnl, remainingCapacity, type Placed } from "../src/lib/market.ts";
import { money } from "../src/lib/format.ts";

const ALICE = 1106, CAROL = 1204;   // current sports ratings
const MAX_POT = 50;                   // what the house says it will lose

// House = Alice, stance "Alice beats Carol". Head to head, so the opponent's
// rating is the difficulty.
const p = lineFor(ALICE, CAROL);
const odds = oddsFrom(p);
console.log(`\n  Alice ${ALICE}  vs  Carol ${CAROL}`);
console.log(`  house says Alice wins -> ${(p * 100).toFixed(1)}%`);
console.log(`  so betting AGAINST the house pays ${odds.multiplierB.toFixed(3)}x\n`);

// Carol backs herself for $10.
const carol: Placed = { userId: "carol", side: "B", amount: 10, multiplier: odds.multiplierB };

console.log("  CAROL WINS:");
const win = settleFixed([carol], "B");
console.log(`    carol gets ${money(win.payouts[0].payout)}  (her ${money(10)} back + ${money(win.payouts[0].profit)})`);
console.log(`    house      ${money(win.bankPnl)}\n`);

console.log("  ALICE WINS:");
const lose = settleFixed([carol], "A");
console.log(`    carol loses ${money(10)}`);
console.log(`    house       ${money(lose.bankPnl)}\n`);

console.log("  --- WHERE THE CAP GOES ---\n");
const byLoss = remainingCapacity([], "B", odds.multiplierB, MAX_POT);
console.log(`  cap on the HOUSE'S LOSS (what's built):`);
console.log(`    takers can stake up to ${money(byLoss)} total`);
const filled: Placed[] = [{ userId: "field", side: "B", amount: byLoss, multiplier: odds.multiplierB }];
console.log(`    if they all win, house is out exactly ${money(-bankPnl(filled, "B"))}\n`);

console.log(`  cap on TOTAL STAKES at ${money(MAX_POT)} (the literal reading):`);
const naive: Placed[] = [{ userId: "field", side: "B", amount: MAX_POT, multiplier: odds.multiplierB }];
console.log(`    takers stake ${money(MAX_POT)}, house is out ${money(-bankPnl(naive, "B"))}  <- under the cap here\n`);

// Now the same two readings on a long shot, where they diverge badly.
console.log("  --- SAME TWO READINGS ON A LONG SHOT (the cold plunge) ---\n");
const lp = lineFor(1125, 1477);
const lo = oddsFrom(lp);
console.log(`  house says "no chance"; taking it on pays ${lo.multiplierA.toFixed(2)}x`);
const lossCap = remainingCapacity([], "A", lo.multiplierA, MAX_POT);
console.log(`    cap on house's loss: takers stake up to ${money(lossCap)}, house out ${money(MAX_POT)}`);
const naiveLong: Placed[] = [{ userId: "field", side: "A", amount: MAX_POT, multiplier: lo.multiplierA }];
console.log(`    cap on total stakes: takers stake ${money(MAX_POT)}, house out ${money(-bankPnl(naiveLong, "A"))}  <-- ${((-bankPnl(naiveLong, "A")) / MAX_POT).toFixed(1)}x what they agreed to\n`);
