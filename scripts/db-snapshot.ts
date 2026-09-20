/**
 * Freeze / restore the demo database.
 *
 *   npm run db:snapshot   copy dev.db -> dev.demo.db
 *   npm run db:restore    copy it back
 *
 * A reseed replays 144 bets through Prisma one row at a time. This is a file
 * copy: instant, and it works even if the seed script is broken. Snapshot once
 * when the circle looks right, then restore between rehearsals and between
 * judging slots.
 */
import { copyFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const LIVE = resolve("prisma/dev.db");
const SNAP = resolve("prisma/dev.demo.db");
const mode = process.argv[2];

const kb = (p: string) => `${(statSync(p).size / 1024).toFixed(0)} KB`;

if (mode === "save") {
  if (!existsSync(LIVE)) {
    console.error("\n  No prisma/dev.db yet. Run npm run db:reset first.\n");
    process.exit(1);
  }
  copyFileSync(LIVE, SNAP);
  console.log(`\n  Snapshot saved — prisma/dev.demo.db (${kb(SNAP)})`);
  console.log("  Restore it any time with: npm run db:restore\n");
} else if (mode === "load") {
  if (!existsSync(SNAP)) {
    console.error("\n  No snapshot yet. Make one with: npm run db:snapshot\n");
    process.exit(1);
  }
  copyFileSync(SNAP, LIVE);
  console.log(`\n  Restored from snapshot (${kb(LIVE)}). Reload the page.\n`);
} else {
  console.error("\n  Usage: db-snapshot.ts save|load\n");
  process.exit(1);
}
