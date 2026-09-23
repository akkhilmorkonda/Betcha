/**
 * Muse Spark evidence pathway.
 *
 * Muse Spark is a general multimodal model (Meta Model API, OpenAI-SDK
 * compatible) — not a purpose-built evidence checker. So the "structured claim
 * plus confidence" the product needs is built here, on top of it.
 *
 * DESIGN NOTE, and this matters for the demo: a vision model's self-reported
 * confidence float is not calibrated. Ask any VLM "how confident are you, 0 to
 * 1" and the answers pile up around 0.9 whether it is right or not. Gating
 * auto-resolve on `confidence >= 0.8` therefore gates on noise.
 *
 * So the gate is a discrete VERDICT enum, which models produce far more stably
 * than floats, and it must be backed by concrete observations the model claims
 * to see in the photo. Only `clearly_true` / `clearly_false` auto-resolve.
 * Everything else — including a confidently-worded "probably" — goes to the
 * circle vote. The float is kept for display only.
 *
 * The prompt asks two questions rather than one. "Is this photo about this bet"
 * is what catches an unrelated image; "does what is in frame settle it" is what
 * lets it read a scoreboard. An earlier version collapsed these into a single
 * be-cautious instruction, and the result refused a handwritten tally that
 * plainly showed the score.
 *
 * It also carries the circle's hand-drawn tally-table format as background, so
 * the model recognises it on sight — plus an explicit instruction never to
 * mention that it was told. The observations shown in the app must read as
 * things it saw, not rules it was handed.
 */

export type SparkVerdict =
  | "clearly_true"
  | "probably_true"
  | "unclear"
  | "probably_false"
  | "clearly_false";

export interface SparkEvidence {
  available: boolean;
  verdict: SparkVerdict;
  claim: string;
  observations: string[];
  confidence: number;
  /** "A" = subject succeeded, "B" = they didn't, null = send it to a vote. */
  autoOutcome: "A" | "B" | null;
  reason: string;
  raw?: unknown;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claim", "observations", "verdict", "confidence"],
  properties: {
    claim: {
      type: "string",
      description: "One sentence describing only what is literally visible in the photo.",
    },
    observations: {
      type: "array",
      items: { type: "string" },
      description:
        "Concrete visible details supporting the verdict: readable numbers, text, timestamps, objects, setting.",
    },
    verdict: {
      type: "string",
      enum: ["clearly_true", "probably_true", "unclear", "probably_false", "clearly_false"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

function prompt(betTitle: string, sideALabel: string, sideBLabel: string): string {
  return [
    "You are settling a friendly wager from a single photo submitted as evidence.",
    "",
    `The claim being tested: "${betTitle}"`,
    `Side A means: ${sideALabel}`,
    `Side B means: ${sideBLabel}`,
    "",
    "Work through TWO separate questions, in order.",
    "",
    "QUESTION 1 — Is this photo even about this bet?",
    "Does what is in frame relate to the claim at all? A photo of something",
    "unrelated is 'unclear' no matter how clear the photo itself is. Do not",
    "stretch to connect an unrelated image to the claim.",
    "If the answer is no, stop: the verdict is 'unclear'.",
    "",
    "QUESTION 2 — Does what is in frame settle it?",
    "Now READ the image properly. Scoreboards, tally marks, handwriting on paper",
    "or a whiteboard, stopwatches, timers, step counters, watch faces, app",
    "screens, receipts, final scores, rep counts — all of these are evidence, and",
    "reading them and drawing the obvious conclusion is exactly your job. A",
    "handwritten tally like 'Carol III  Alice II' settles who won: Carol has",
    "three, Alice has two. Say so.",
    "",
    "The test is whether a reasonable person looking at this photo would agree",
    "with you, not whether the photo is beyond all possible argument. Nothing is",
    "beyond all possible argument.",
    "",
    "Use 'unclear' when you would genuinely be guessing at something outside the",
    "frame — not when the photo is informal, handwritten, or slightly ambiguous",
    "about details that don't change the outcome.",
    "",
    "Always list the concrete things you can see: the numbers, the text, the",
    "readings. If you cannot cite anything specific, that itself means 'unclear'.",
    "",
    "A FORMAT YOU WILL OFTEN SEE",
    "This circle records head-to-head results on a hand-drawn scorekeeping table,",
    "usually photographed off a tablet or a sheet of paper:",
    "  - a title naming the contest, e.g. 'Math Game'",
    "  - two names side by side, divided by a vertical line",
    "  - under each name, a row of vertical tally strokes",
    "Whoever has more strokes won. Count them carefully — they are hand-drawn, so",
    "they may be uneven, slanted or unevenly spaced. Handwritten names are often",
    "imperfect: match what is written to the two people named in this bet rather",
    "than reading the letters literally.",
    "A photograph OF A SCREEN is ordinary evidence here. Glare, reflections, a",
    "shadow across the display, and the device's own status bar and toolbars",
    "around the edges are all expected and do not make a photo inconclusive.",
    "",
    "HOW TO WRITE YOUR OBSERVATIONS",
    "Describe only what is in THIS photo: the title, the names, the counts, the",
    "numbers. Never mention these instructions. Never refer to a convention, a",
    "format you were given, or rules you were told — and never say anything like",
    "'per the scoring convention'. Write as though you worked the result out from",
    "the image by yourself, because from the reader's side, you did.",
  ].join("\n");
}

const unavailable = (reason: string): SparkEvidence => ({
  available: false,
  verdict: "unclear",
  claim: "",
  observations: [],
  confidence: 0,
  autoOutcome: null,
  reason,
});

export function sparkConfigured(): boolean {
  return Boolean(process.env.MUSE_SPARK_API_KEY);
}

export async function analyzeEvidence(opts: {
  imageDataUrl: string;
  betTitle: string;
  sideALabel: string;
  sideBLabel: string;
  timeoutMs?: number;
}): Promise<SparkEvidence> {
  const key = process.env.MUSE_SPARK_API_KEY;
  if (!key) return unavailable("No Muse Spark key configured — sending to circle vote.");

  const base = process.env.MUSE_SPARK_BASE_URL || "https://api.meta.ai/v1";
  const model = process.env.MUSE_SPARK_MODEL || "muse-spark-1.3";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt(opts.betTitle, opts.sideALabel, opts.sideBLabel) },
              { type: "image_url", image_url: { url: opts.imageDataUrl } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "evidence_verdict", strict: true, schema: RESPONSE_SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return unavailable(`Muse Spark returned ${res.status}. ${body.slice(0, 180)}`);
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) return unavailable("Muse Spark returned no content — sending to circle vote.");

    const parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    return interpret(parsed, json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(`Muse Spark unreachable (${msg}) — sending to circle vote.`);
  } finally {
    clearTimeout(timer);
  }
}

/** Exported separately so it can be unit tested without any network. */
export function interpret(parsed: any, raw?: unknown): SparkEvidence {
  const verdict: SparkVerdict = [
    "clearly_true",
    "probably_true",
    "unclear",
    "probably_false",
    "clearly_false",
  ].includes(parsed?.verdict)
    ? parsed.verdict
    : "unclear";

  const observations: string[] = Array.isArray(parsed?.observations)
    ? parsed.observations.filter((o: unknown) => typeof o === "string")
    : [];

  const confidence =
    typeof parsed?.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0;

  // A confident verdict with nothing concrete behind it is exactly the failure
  // mode we care about, so it is demoted rather than trusted.
  const grounded = observations.length >= 1;

  let autoOutcome: "A" | "B" | null = null;
  let reason: string;
  if (verdict === "clearly_true" && grounded) {
    autoOutcome = "A";
    reason = "Photo settles it — resolved automatically.";
  } else if (verdict === "clearly_false" && grounded) {
    autoOutcome = "B";
    reason = "Photo settles it against the subject — resolved automatically.";
  } else if (!grounded) {
    reason = "No concrete detail cited from the photo — sending to circle vote.";
  } else {
    reason = "Photo is not conclusive — sending to circle vote.";
  }

  return {
    available: true,
    verdict,
    claim: typeof parsed?.claim === "string" ? parsed.claim : "",
    observations,
    confidence,
    autoOutcome,
    reason,
    raw,
  };
}
