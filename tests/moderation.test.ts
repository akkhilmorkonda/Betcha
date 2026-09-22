import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_ONLY_CATEGORIES,
  TITLE_POLICY,
  TITLE_VERDICTS,
  isTemplateOnly,
  templateRefusal,
  localTitleRefusal,
  interpretTitleVerdict,
  interpretImageModeration,
  reviewTitle,
  moderateImage,
  titleClassifierConfigured,
  imageModerationConfigured,
  unreviewedTitlesPermitted,
  type TitleVerdictCode,
  isRetryableStatus,
  retryDelayMs,
  CLASSIFIER_MAX_ATTEMPTS,
} from "../src/lib/moderation.ts";
import { CATEGORIES } from "../src/lib/categories.ts";
import { mulberry32 } from "../src/lib/rng.ts";

/**
 * CONTENT SAFETY. Guideline 1.4.5 is the existential risk for this app, so
 * these are the tests that decide whether it ships.
 *
 * The file is organised the way the module is: the structural rule (a whole
 * category has no free text), the written policy enforced offline, and then the
 * two model gates — each of which must gate on a categorical outcome and never
 * on a float, which is invariant 9 applied to a second and third model.
 */

// No key in CI, no key in local dave, and none invented here. Everything below
// that does not stub fetch runs the path the project actually runs.
delete process.env.OPENAI_API_KEY;

// ---------------------------------------------------------------------------
// 1. Structural: dares are template-only.
// ---------------------------------------------------------------------------

test("dares is the template-only category, and it is a real category", () => {
  assert.deepEqual([...TEMPLATE_ONLY_CATEGORIES], ["dares"]);
  for (const c of TEMPLATE_ONLY_CATEGORIES)
    assert.ok((CATEGORIES as readonly string[]).includes(c));
  assert.equal(isTemplateOnly("dares"), true);
});

test("a dare with no template is refused", () => {
  assert.equal(templateRefusal({ category: "dares" }), "needs-a-template");
  assert.equal(templateRefusal({ category: "dares", templateId: null }), "needs-a-template");
  assert.equal(templateRefusal({ category: "dares", templateId: "" }), "needs-a-template");
});

test("a dare from the vetted bank is allowed", () => {
  assert.equal(
    templateRefusal({ category: "dares", templateId: "d2", templateCategory: "dares" }),
    null
  );
});

/**
 * The bypass this closes: name a `grades` template id on a `dares` bet and the
 * free-text title rides in attached to a template that has nothing to do with
 * it. The schema can only see the id, so it enforces presence; createBet loads
 * the row and enforces the match.
 */
test("a dare pointed at some other category's template is refused", () => {
  assert.equal(
    templateRefusal({ category: "dares", templateId: "g4", templateCategory: "grades" }),
    "template-category-mismatch"
  );
  assert.equal(
    templateRefusal({ category: "dares", templateId: "nope", templateCategory: null }),
    "template-category-mismatch",
    "a templateId that resolves to nothing is not a vetted template"
  );
});

test("presence alone passes when the row has not been loaded yet", () => {
  assert.equal(templateRefusal({ category: "dares", templateId: "d2" }), null);
});

test("free text survives in every other category", () => {
  for (const category of CATEGORIES) {
    if (isTemplateOnly(category)) continue;
    assert.equal(
      templateRefusal({ category, templateId: null, templateCategory: null }),
      null,
      `${category} should still accept free text`
    );
  }
});

/** 5,000 random pairs: a free-text dare never gets through, on any input. */
test("FUZZ: no combination of inputs lets a free-text dare through", () => {
  const rnd = mulberry32(0x1405);
  const ids = [null, undefined, "", "t1", "d2", "whatever"];
  const cats = [...CATEGORIES, "unknown", ""];
  for (let i = 0; i < 5000; i++) {
    const category = cats[Math.floor(rnd() * cats.length)];
    const templateId = ids[Math.floor(rnd() * ids.length)];
    const templateCategory =
      rnd() < 0.5 ? undefined : cats[Math.floor(rnd() * cats.length)];
    const r = templateRefusal({ category, templateId, templateCategory });

    if (isTemplateOnly(category)) {
      const vetted = Boolean(templateId) && (templateCategory === undefined || templateCategory === category);
      assert.equal(r === null, vetted, `dares slipped through: ${templateId}/${templateCategory}`);
    } else {
      assert.equal(r, null, `${category} should never be blocked by the template rule`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. The written policy, enforced offline.
// ---------------------------------------------------------------------------

test("the policy names every refusing verdict the gate knows about", () => {
  for (const code of TITLE_VERDICTS) {
    if (code === "safe" || code === "unclear") continue;
    assert.ok(TITLE_POLICY.includes(code), `policy text never mentions ${code}`);
  }
});

test("the offline policy refuses self-harm however it is phrased", () => {
  for (const t of [
    "Alice says he'll kill himself if he fails",
    "Bob goes a week without self-harm",
    "Erin beats her anorexia streak",
    "Dave overdoses on caffeine pills",
    "Frank hangs himself from the rafters",
  ]) {
    assert.equal(localTitleRefusal(t), "self_harm", `allowed: ${t}`);
  }
});

test("the offline policy refuses the unambiguous physical-risk phrasings", () => {
  assert.equal(localTitleRefusal("Dave drinks bleach for $5"), "physical_risk");
  assert.equal(localTitleRefusal("Frank eats a tide pod"), "physical_risk");
  assert.equal(localTitleRefusal("Bob jumps off the roof into the pool"), "physical_risk");
  assert.equal(localTitleRefusal("Carol runs into traffic on Mass Ave"), "physical_risk");
  assert.equal(localTitleRefusal("Alice gets blackout drunk before the exam"), "physical_risk");
});

test("the offline policy refuses the unambiguous illegal and sexual phrasings", () => {
  assert.equal(localTitleRefusal("Erin shoplifts from the CVS"), "illegal");
  assert.equal(localTitleRefusal("Dave trespasses on the roof of Building 10"), "illegal");
  assert.equal(localTitleRefusal("Frank sends nudes to the group chat"), "sexual");
  assert.equal(localTitleRefusal("Bob gets naked in the Infinite"), "sexual");
});

test("curly quotes and odd spacing do not evade the offline policy", () => {
  assert.equal(localTitleRefusal("Alice   KILLS   HIMSELF   at trivia"), "self_harm");
  assert.equal(localTitleRefusal("Dave’ll shoplift a Red Bull"), "illegal");
});

/**
 * The half of this that matters just as much. The offline list is a backstop,
 * not a classifier, and a false refusal is a user who cannot post an ordinary
 * bet with no appeal button. "Steal" is absent on purpose: stealing second base
 * is a normal sports bet.
 */
test("ordinary bets are not touched by the offline policy", () => {
  for (const t of [
    "Alice gets an A on 6.006",
    "Bob beats Carol at the math game",
    "Erin finishes the problem set before midnight",
    "Frank steals second base",
    "Dave kills it at the career fair",
    "Carol runs 5 miles under 40 minutes",
    "Alice goes a week without Instagram",
    "Bob does karaoke stone cold sober",
    "Dave wakes up at 5am three days straight",
    "Erin wins her intramural soccer final",
    "Frank does 100 pushups in one sitting",
    "Carol goes a full day without caffeine",
  ]) {
    assert.equal(localTitleRefusal(t), null, `falsely refused: ${t}`);
  }
});

test("an empty title is not safe by default", () => {
  assert.equal(localTitleRefusal(""), "unclear");
  assert.equal(localTitleRefusal("   "), "unclear");
});

// ---------------------------------------------------------------------------
// 3. The title gate. Invariant 9, second model.
// ---------------------------------------------------------------------------

test("only the literal verdict 'safe' allows", () => {
  assert.equal(interpretTitleVerdict({ verdict: "safe", confidence: 0.5 }).decision, "allow");
  for (const code of TITLE_VERDICTS) {
    if (code === "safe") continue;
    assert.equal(
      interpretTitleVerdict({ verdict: code, confidence: 0.99 }).decision,
      "refuse",
      `${code} allowed something through`
    );
  }
});

test("a verdict the model invented collapses to unclear, which refuses", () => {
  for (const bad of [undefined, null, "", "SAFE", "ok", "yes", 1, {}, ["safe"], true]) {
    const r = interpretTitleVerdict({ verdict: bad, confidence: 1 });
    assert.equal(r.code, "unclear", `${JSON.stringify(bad)} did not collapse`);
    assert.equal(r.decision, "refuse", `${JSON.stringify(bad)} was allowed`);
  }
});

test("a malformed payload refuses and does not throw", () => {
  for (const bad of [{}, null, undefined, 42, "text", []]) {
    assert.doesNotThrow(() => interpretTitleVerdict(bad));
    assert.equal(interpretTitleVerdict(bad).decision, "refuse");
  }
});

/**
 * REGRESSION, and the whole reason this module looks the way it does.
 *
 * Spark once returned `confidence 0.99, verdict "unclear"` on a photo of a
 * fridge; under a confidence threshold that photo would have paid out real
 * positions. The same mistake is available here in both directions — publish a
 * refused title because the model was only 3% sure, or refuse a safe one
 * because it was only 40% sure. The float is display only. No branch reads it.
 */
test("REGRESSION: confidence never changes a title decision, at any value", () => {
  for (const confidence of [0, 0.01, 0.3, 0.5, 0.79, 0.8, 0.9, 0.99, 1, 4.2, -3, NaN]) {
    assert.equal(
      interpretTitleVerdict({ verdict: "safe", confidence }).decision,
      "allow",
      `safe at ${confidence} was refused`
    );
    assert.equal(
      interpretTitleVerdict({ verdict: "physical_risk", confidence }).decision,
      "refuse",
      `physical_risk at ${confidence} was allowed`
    );
  }
});

test("confidence is still clamped into [0,1] for display", () => {
  assert.equal(interpretTitleVerdict({ verdict: "safe", confidence: 4.2 }).confidence, 1);
  assert.equal(interpretTitleVerdict({ verdict: "safe", confidence: -3 }).confidence, 0);
  assert.equal(interpretTitleVerdict({ verdict: "safe", confidence: NaN }).confidence, 0);
  assert.equal(interpretTitleVerdict({ verdict: "safe" }).confidence, 0);
});

test("a refused title carries a reason a user can read", () => {
  const canned = interpretTitleVerdict({ verdict: "physical_risk", confidence: 0.9 });
  assert.ok(canned.reason.length > 0);
  const own = interpretTitleVerdict({
    verdict: "illegal",
    confidence: 0.9,
    reason: "This asks someone to break into a building.",
  });
  assert.equal(own.reason, "This asks someone to break into a building.");
});

/** 20,000 payloads. Allowed if and only if the verdict enum says "safe". */
test("FUZZ: the title gate depends on the enum and on nothing else", () => {
  const rnd = mulberry32(0xbe7c4a);
  const verdicts: unknown[] = [...TITLE_VERDICTS, "SAFE", "fine", "", null, undefined, 0, 1, {}];
  for (let i = 0; i < 20000; i++) {
    const verdict = verdicts[Math.floor(rnd() * verdicts.length)];
    const confidence = rnd() * 3 - 1; // deliberately out of range half the time
    const r = interpretTitleVerdict({ verdict, confidence, reason: rnd() < 0.5 ? "x" : 7 });
    assert.equal(
      r.decision === "allow",
      verdict === "safe",
      `${JSON.stringify(verdict)} @ ${confidence} decided ${r.decision}`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. The photo gate. Invariant 9, third model.
// ---------------------------------------------------------------------------

const clean = (scores: Record<string, number> = {}) => ({
  results: [
    {
      flagged: false,
      categories: { violence: false, sexual: false, "self-harm": false },
      category_scores: scores,
    },
  ],
});

test("a clean photo is allowed", () => {
  const r = interpretImageModeration(clean());
  assert.equal(r.decision, "allow");
  assert.equal(r.reviewed, true);
  assert.deepEqual(r.flaggedCategories, []);
});

test("a flagged photo is refused and names what tripped", () => {
  const r = interpretImageModeration({
    results: [{ flagged: true, categories: { violence: true, sexual: false } }],
  });
  assert.equal(r.decision, "refuse");
  assert.deepEqual(r.flaggedCategories, ["violence"]);
});

/**
 * flagged and the category booleans are checked independently. If the endpoint
 * ever returns a true category alongside flagged:false, that is a disagreement
 * inside the response and the cautious reading wins.
 */
test("a true category refuses even when flagged is false", () => {
  const r = interpretImageModeration({
    results: [{ flagged: false, categories: { "self-harm": true } }],
  });
  assert.equal(r.decision, "refuse");
});

test("an unreadable moderation response refuses, it does not degrade to allow", () => {
  for (const bad of [
    {},
    null,
    undefined,
    42,
    "text",
    { results: [] },
    { results: {} },
    { results: [{}] },
    { results: [{ flagged: "false" }] },
    { results: [{ flagged: 0 }] },
    { results: [{ flagged: null, categories: {} }] },
  ]) {
    const r = interpretImageModeration(bad);
    assert.equal(r.decision, "refuse", `${JSON.stringify(bad)} was allowed`);
    assert.equal(r.reviewed, false, `${JSON.stringify(bad)} claimed to be reviewed`);
  }
});

test("a truthy non-boolean category is not a verdict either way", () => {
  // "1" is not true, so it does not refuse on its own — but the response is
  // otherwise clean, so this documents that only booleans are consulted.
  const r = interpretImageModeration({
    results: [{ flagged: false, categories: { violence: 1, sexual: "yes" } }],
  });
  assert.equal(r.decision, "allow");
});

/**
 * REGRESSION: the /moderations response hands you a dictionary of floats named
 * `category_scores` sitting right beside the booleans. It is the same trap as
 * Spark's confidence in a different costume — a threshold tuned once against a
 * handful of images that then quietly disagrees with the endpoint's own
 * judgement forever. Nothing in moderation.ts reads them, and these two cases
 * fail loudly if anyone reintroduces the idea.
 */
test("REGRESSION: category_scores are never the gate, in either direction", () => {
  const screaming = interpretImageModeration(
    clean({ violence: 0.999, sexual: 0.998, "self-harm": 0.997 })
  );
  assert.equal(screaming.decision, "allow", "a score threshold refused a clean photo");

  const whispering = interpretImageModeration({
    results: [
      {
        flagged: true,
        categories: { violence: true },
        category_scores: { violence: 0.001, sexual: 0.0 },
      },
    ],
  });
  assert.equal(whispering.decision, "refuse", "a score threshold published a flagged photo");
});

test("REGRESSION: no score ever reaches the caller, so none can be gated on later", () => {
  const r = interpretImageModeration(clean({ violence: 0.999 })) as unknown as Record<
    string,
    unknown
  >;
  assert.equal("category_scores" in r, false);
  assert.equal("score" in r, false);
  assert.equal("confidence" in r, false);
});

/** 20,000 responses with random scores. The booleans decide, alone. */
test("FUZZ: the photo gate depends on the booleans and on nothing else", () => {
  const rnd = mulberry32(0x0d0de5);
  for (let i = 0; i < 20000; i++) {
    const flagged = rnd() < 0.3;
    const cats = {
      violence: rnd() < 0.15,
      sexual: rnd() < 0.15,
      "self-harm": rnd() < 0.15,
    };
    const scores = {
      violence: rnd(),
      sexual: rnd(),
      "self-harm": rnd(),
    };
    const r = interpretImageModeration({ results: [{ flagged, categories: cats, category_scores: scores }] });
    const shouldAllow = !flagged && !Object.values(cats).some(Boolean);
    assert.equal(
      r.decision === "allow",
      shouldAllow,
      `flagged=${flagged} cats=${JSON.stringify(cats)} decided ${r.decision}`
    );
  }
});

test("every result in a multi-result response is checked, not just the first", () => {
  const r = interpretImageModeration({
    results: [
      { flagged: false, categories: { violence: false } },
      { flagged: true, categories: { sexual: true } },
    ],
  });
  assert.equal(r.decision, "refuse");
});

// ---------------------------------------------------------------------------
// 5. The no-key path — the one CI and local dave actually run.
// ---------------------------------------------------------------------------

test("with no key, neither check reports itself as configured", () => {
  assert.equal(titleClassifierConfigured(), false);
  assert.equal(imageModerationConfigured(), false);
});

/**
 * PHOTOS FAIL CLOSED. There is no offline fallback for an image: unreviewed and
 * unscreened are the same thing, and an unscreened photo must never reach a
 * circle vote where other members look at it. This makes no network call — it
 * returns before fetch is ever reached.
 */
test("with no key a photo is REFUSED, never quietly accepted", async () => {
  const r = await moderateImage({ imageDataUrl: "data:image/png;base64,AAAA" });
  assert.equal(r.decision, "refuse");
  assert.equal(r.reviewed, false);
  assert.ok(r.reason.length > 0);
});

/**
 * TITLES fall back to the offline policy, which still ran. A refused phrase is
 * refused with no key, no network and no spend.
 */
test("with no key the offline policy still refuses what it knows", async () => {
  const r = await reviewTitle({ text: "Dave drinks bleach for $5" });
  assert.equal(r.decision, "refuse");
  assert.equal(r.source, "policy");
  assert.equal(r.reviewed, false);
});

/**
 * And an ordinary title is allowed — with reviewed:false on the record, so the
 * caller can tell "the classifier passed it" from "the classifier never ran".
 * That is the difference between this and a silent allow.
 */
test("with no key an ordinary title is allowed, but marked unreviewed", async () => {
  const r = await reviewTitle({ text: "Alice gets an A on 6.006" });
  assert.equal(r.decision, "allow");
  assert.equal(r.reviewed, false);
  assert.equal(r.source, "unreviewed");
});

test("the offline policy runs first, so a refused title never costs a model call", async () => {
  process.env.OPENAI_API_KEY = "k";
  const real = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("the classifier must not have been called");
  }) as typeof fetch;
  try {
    const r = await reviewTitle({ text: "Frank eats a tide pod" });
    assert.equal(r.decision, "refuse");
    assert.equal(r.source, "policy");
  } finally {
    globalThis.fetch = real;
    delete process.env.OPENAI_API_KEY;
  }
});

// ---------------------------------------------------------------------------
// 6. The key-present paths, with fetch stubbed. No network in this suite.
// ---------------------------------------------------------------------------

async function withFetch<T>(impl: unknown, fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = impl as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
    delete process.env.OPENAI_API_KEY;
  }
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const chat = (payload: unknown) =>
  jsonResponse({ choices: [{ message: { content: JSON.stringify(payload) } }] });

test("a configured classifier that says safe allows, and says it reviewed it", async () => {
  const r = await withFetch(
    async () => chat({ verdict: "safe", confidence: 0.42, reason: "" }),
    () => reviewTitle({ text: "Alice gets an A on 6.006" })
  );
  assert.equal(r.decision, "allow");
  assert.equal(r.reviewed, true);
  assert.equal(r.source, "classifier");
});

test("a configured classifier catches what the offline list cannot", async () => {
  // The offline list deliberately does NOT know "cold plunge" — that is a
  // judgement call, and it is the classifier's job.
  assert.equal(localTitleRefusal("Alice cold-plunges for 3 minutes"), null);
  const r = await withFetch(
    async () => chat({ verdict: "physical_risk", confidence: 0.2, reason: "Cold exposure." }),
    () => reviewTitle({ text: "Alice cold-plunges for 3 minutes" })
  );
  assert.equal(r.decision, "refuse");
  assert.equal(r.reason, "Cold exposure.");
});

/**
 * Configured and failing is NOT the same as unconfigured. A key is the operator
 * saying "this check runs"; a timeout must not quietly downgrade production to
 * the offline policy.
 */
test("a configured classifier that errors REFUSES rather than falling back", async () => {
  for (const impl of [
    async () => {
      throw new Error("ECONNRESET");
    },
    async () => new Response("nope", { status: 500 }),
    async () => new Response("nope", { status: 429 }),
    async () => jsonResponse({ choices: [] }),
    async () => jsonResponse({ choices: [{ message: { content: "not json" } }] }),
  ]) {
    const r = await withFetch(impl, () => reviewTitle({ text: "Alice gets an A" }));
    assert.equal(r.decision, "refuse", "a failed classifier call allowed a title");
    assert.equal(r.reviewed, false);
  }
});

test("a configured moderation endpoint allows a clean photo", async () => {
  const r = await withFetch(
    async () => jsonResponse(clean({ violence: 0.99 })),
    () => moderateImage({ imageDataUrl: "data:image/png;base64,AAAA" })
  );
  assert.equal(r.decision, "allow");
  assert.equal(r.reviewed, true);
});

test("a configured moderation endpoint that errors refuses the photo", async () => {
  for (const impl of [
    async () => {
      throw new Error("timeout");
    },
    async () => new Response("nope", { status: 500 }),
    async () => jsonResponse({ results: [] }),
  ]) {
    const r = await withFetch(impl, () =>
      moderateImage({ imageDataUrl: "data:image/png;base64,AAAA" })
    );
    assert.equal(r.decision, "refuse");
    assert.equal(r.reviewed, false);
  }
});

test("a flagged photo from a configured endpoint is refused", async () => {
  const r = await withFetch(
    async () =>
      jsonResponse({
        results: [
          {
            flagged: true,
            categories: { "self-harm": true },
            category_scores: { "self-harm": 0.004 },
          },
        ],
      }),
    () => moderateImage({ imageDataUrl: "data:image/png;base64,AAAA" })
  );
  assert.equal(r.decision, "refuse");
  assert.deepEqual(r.flaggedCategories, ["self-harm"]);
});

/** The gate is one exported type; keep the enum and the gate in step. */
test("every verdict in the enum has a decision", () => {
  const codes: TitleVerdictCode[] = [...TITLE_VERDICTS];
  assert.equal(codes.length, 7);
  for (const c of codes) {
    const d = interpretTitleVerdict({ verdict: c }).decision;
    assert.ok(d === "allow" || d === "refuse");
  }
});

/**
 * THE INVARIANT: production never allows a title the classifier has not seen.
 *
 * The keyless allow path exists so CI and a laptop can create a bet without a
 * paid key. In production that same path is a liability — a key that is
 * missing, revoked, mistyped or never set on a new host would downgrade the
 * whole title defence to the small offline keyword list, silently. `custom` is
 * unconstrained free text, so that downgrade is precisely the Guideline 1.4.5
 * gap the template bank exists to close.
 */
test("production refuses to allow titles no classifier has seen", () => {
  assert.equal(unreviewedTitlesPermitted("production"), false);
});

test("development and test may still create bets without a key", () => {
  assert.equal(unreviewedTitlesPermitted("development"), true);
  assert.equal(unreviewedTitlesPermitted("test"), true);
  // An unset NODE_ENV is a laptop, not a server — `next start` sets production.
  assert.equal(unreviewedTitlesPermitted(undefined), true);
});

test("FUZZ: any environment that is not explicitly development or test fails closed", () => {
  const envs = [
    "production", "PRODUCTION", "Production", "prod", "staging", "preview",
    "release", "ci", "", "développement", "development ", " development",
    "test-ci", "testing", "dev",
  ];
  for (const e of envs) {
    assert.equal(
      unreviewedTitlesPermitted(e),
      e === "development" || e === "test",
      `NODE_ENV=${JSON.stringify(e)} took the wrong branch`
    );
  }
});

/**
 * RETRY POLICY. A transient 429 must not read as "this title is unsafe".
 *
 * Measured before writing this: four identical calls to the real API produced
 * one 429 and three correct `physical_risk` verdicts. Because the classifier
 * fails closed, that one 429 refused a bet the model would have judged fine.
 */
test("only genuinely transient statuses are retried", () => {
  for (const s of [408, 429, 500, 502, 503, 504, 599]) {
    assert.equal(isRetryableStatus(s), true, `${s} should be retried`);
  }
  // A bad request or a bad key is not going to fix itself. Retrying hides a
  // misconfiguration behind latency and fails the same way anyway.
  for (const s of [200, 201, 400, 401, 403, 404, 409, 422]) {
    assert.equal(isRetryableStatus(s), false, `${s} must NOT be retried`);
  }
});

test("backoff grows, and is capped so a request cannot hang", () => {
  const a = retryDelayMs(1);
  const b = retryDelayMs(2);
  const c = retryDelayMs(3);
  assert.ok(a < b, "backoff should grow");
  assert.ok(b <= c, "backoff should not shrink");
  for (const n of [1, 2, 3, 10, 100]) {
    assert.ok(retryDelayMs(n) <= 2000, `attempt ${n} exceeded the cap`);
  }
});

test("Retry-After is honoured when the server sends a sane one", () => {
  assert.equal(retryDelayMs(1, "1"), 1000);
  // Capped: a server asking for an hour must not hang a bet creation.
  assert.equal(retryDelayMs(1, "3600"), 2000);
});

test("a junk Retry-After falls back to backoff instead of throwing", () => {
  for (const bad of ["", "soon", "-5", "0", "NaN", null, undefined]) {
    const d = retryDelayMs(1, bad as string | null | undefined);
    assert.ok(Number.isFinite(d) && d > 0 && d <= 2000, `bad value ${JSON.stringify(bad)} gave ${d}`);
  }
});

test("attempts are bounded, so failing closed still happens", () => {
  assert.ok(CLASSIFIER_MAX_ATTEMPTS >= 2, "retrying at all requires >1 attempt");
  assert.ok(CLASSIFIER_MAX_ATTEMPTS <= 4, "too many attempts turns a refusal into a hang");
});
