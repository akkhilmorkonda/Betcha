/**
 * Verify the Muse Spark key, endpoint and model BEFORE the demo.
 *
 *   npm run spark:check                 # auth + model ping only
 *   npm run spark:check ./photo.jpg     # full evidence round trip
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { analyzeEvidence, sparkConfigured } from "../src/lib/spark.ts";

const base = process.env.MUSE_SPARK_BASE_URL || "https://api.meta.ai/v1";
const model = process.env.MUSE_SPARK_MODEL || "muse-spark-1.3";

if (!sparkConfigured()) {
  console.error("\n  MUSE_SPARK_API_KEY is empty in .env.");
  console.error("  The app still runs — evidence submission falls to a circle vote.\n");
  process.exit(1);
}

console.log(`\n  endpoint  ${base}/chat/completions`);
console.log(`  model     ${model}\n`);

const file = process.argv[2];

if (!file) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MUSE_SPARK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
    }),
  });
  const body = await res.text();
  console.log(`  status ${res.status}`);
  console.log(`  ${body.slice(0, 400)}\n`);
  if (!res.ok) {
    console.error("  Auth or model name is wrong. Fix MUSE_SPARK_* in .env.\n");
    process.exit(1);
  }
  console.log("  Auth works. Re-run with a photo path to test the evidence path.\n");
  process.exit(0);
}

const full = resolve(file);
if (!existsSync(full)) {
  console.error(`  No file at ${full}`);
  console.error(`  Paths are relative to the project root — try ./tests/yourphoto.jpg\n`);
  process.exit(1);
}

const mime =
  { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[
    extname(full).toLowerCase()
  ] || "image/jpeg";

const bytes = statSync(full).size;
const b64 = readFileSync(full).toString("base64");
const mb = (n: number) => (n / 1_048_576).toFixed(1);
console.log(`  file      ${mb(bytes)} MB on disk, ${mb(b64.length)} MB encoded`);

// The app downscales to 1280px in the browser before upload; this script sends
// the raw file, so a phone-sized original can be rejected or just be slow.
if (b64.length > 4_000_000) {
  console.log("  NOTE      large payload — a 4xx here may be size, not auth.\n");
} else {
  console.log("");
}

const dataUrl = `data:${mime};base64,${b64}`;

const result = await analyzeEvidence({
  imageDataUrl: dataUrl,
  betTitle: "Alice runs 5 miles under 40 minutes",
  sideALabel: "He did it",
  sideBLabel: "He didn't",
});

console.log("  available   ", result.available);
console.log("  verdict     ", result.verdict);
console.log("  confidence  ", result.confidence);
console.log("  claim       ", result.claim);
console.log("  observations");
for (const o of result.observations) console.log("               -", o);
console.log("  autoOutcome ", result.autoOutcome ?? "→ circle vote");
console.log("  reason      ", result.reason, "\n");
