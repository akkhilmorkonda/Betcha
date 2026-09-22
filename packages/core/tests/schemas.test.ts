import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBetBody,
  placePositionBody,
  castVoteBody,
  submitEvidenceBody,
  createCircleBody,
} from "../src/schemas.ts";
import { MIN_STAKE, MIN_LIABILITY, MAX_LIABILITY } from "../src/market.ts";

const ok = (schema: any, v: unknown) => schema.safeParse(v).success;

/**
 * `dares` carries a templateId now: the category is template-only at launch
 * (Guideline 1.4.5 — see src/lib/moderation.ts), so a dare with free text and
 * no template is no longer a valid body. The rule itself is exercised below.
 */
const validBet = {
  circleId: "c1",
  subjectId: "u1",
  category: "dares",
  title: "Cold plunge",
  templateId: "d1",
};

test("a minimal valid bet is accepted", () => {
  assert.equal(ok(createBetBody, validBet), true);
});

/**
 * .strict() everywhere. An unexpected key is the difference between a typo and
 * a mass assignment — the routes used to spread the body onward.
 */
test("an unknown field is refused, not quietly forwarded", () => {
  assert.equal(ok(createBetBody, { ...validBet, creatorId: "someone-else" }), false);
  assert.equal(ok(placePositionBody, { side: "A", amount: 500, userId: "x" }), false);
  assert.equal(ok(castVoteBody, { side: "A", betId: "x" }), false);
  assert.equal(ok(createCircleBody, { name: "x", ownerId: "x" }), false);
});

test("category is closed to the known set", () => {
  assert.equal(ok(createBetBody, { ...validBet, category: "crimes" }), false);
  assert.equal(ok(createBetBody, { ...validBet, category: "grades" }), true);
});

test("a title cannot be empty, whitespace, or unbounded", () => {
  assert.equal(ok(createBetBody, { ...validBet, title: "" }), false);
  assert.equal(ok(createBetBody, { ...validBet, title: "   " }), false);
  assert.equal(ok(createBetBody, { ...validBet, title: "x".repeat(141) }), false);
  assert.equal(ok(createBetBody, { ...validBet, title: "x".repeat(140) }), true);
});

test("a title is trimmed, and the trimmed value is what comes out", () => {
  const r = createBetBody.parse({ ...validBet, title: "  Cold plunge  " });
  assert.equal(r.title, "Cold plunge");
});

test("liability is bounded by the same constants the engine enforces", () => {
  assert.equal(ok(createBetBody, { ...validBet, liability: MIN_LIABILITY - 1 }), false);
  assert.equal(ok(createBetBody, { ...validBet, liability: MAX_LIABILITY + 1 }), false);
  assert.equal(ok(createBetBody, { ...validBet, liability: MIN_LIABILITY }), true);
  assert.equal(ok(createBetBody, { ...validBet, liability: MAX_LIABILITY }), true);
});

test("money must be whole cents", () => {
  assert.equal(ok(placePositionBody, { side: "A", amount: 100.5 }), false);
  assert.equal(ok(placePositionBody, { side: "A", amount: 100 }), true);
  assert.equal(ok(createBetBody, { ...validBet, liability: 2500.5 }), false);
});

/** Number("abc") was NaN, and NaN flowed straight into balance arithmetic. */
test("REGRESSION: NaN and Infinity are not numbers this API accepts", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.equal(ok(placePositionBody, { side: "A", amount: bad }), false, `${bad} accepted`);
  }
  assert.equal(ok(placePositionBody, { side: "A", amount: "500" }), false, "string accepted");
});

test("a stake below the minimum is refused at the boundary, not deep in the engine", () => {
  assert.equal(ok(placePositionBody, { side: "A", amount: MIN_STAKE - 1 }), false);
  assert.equal(ok(placePositionBody, { side: "A", amount: MIN_STAKE }), true);
});

test("side is exactly A or B", () => {
  for (const bad of ["a", "C", "", null, 1, ["A"]]) {
    assert.equal(ok(castVoteBody, { side: bad }), false, `${JSON.stringify(bad)} accepted`);
  }
  assert.equal(ok(castVoteBody, { side: "A" }), true);
  assert.equal(ok(castVoteBody, { side: "B" }), true);
});

/**
 * Evidence must be an inline image. A remote URL here would make the server
 * fetch whatever the caller named, which is a request-forgery primitive.
 */
test("evidence must be an inline data image, never a remote URL", () => {
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: "data:image/png;base64,AAAA" }), true);
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: "https://example.com/a.png" }), false);
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: "file:///etc/passwd" }), false);
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: "data:text/html,<script>" }), false);
});

test("submitting no photo stays a first-class path", () => {
  assert.equal(ok(submitEvidenceBody, {}), true);
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: null }), true);
  // What the "can't photograph this" button actually sends. It used to fail
  // startsWith and come back a 400, so the vote route was unreachable from the
  // UI at all.
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: "" }), true);
  assert.equal(submitEvidenceBody.parse({ imageDataUrl: "" }).imageDataUrl, null);
});

test("an oversized photo is refused", () => {
  const huge = "data:image/png;base64," + "A".repeat(6_000_001);
  assert.equal(ok(submitEvidenceBody, { imageDataUrl: huge }), false);
});

/**
 * Guideline 1.4.5: "apps should not urge customers to participate in activities
 * (like bets, challenges, etc.) ... that risks physical harm." `dares` is the
 * category that by name invites exactly that, so at launch its propositions
 * come from the vetted template bank and nowhere else. Checked here at the
 * boundary and again in createBet, which can also see whether the template is
 * real. See src/lib/moderation.ts.
 */
test("a dare with free text and no template is refused at the boundary", () => {
  const freeText = { ...validBet, templateId: undefined };
  assert.equal(ok(createBetBody, freeText), false);
  assert.equal(ok(createBetBody, { ...validBet, templateId: null }), false);
  assert.equal(ok(createBetBody, { ...validBet, templateId: "d1" }), true);
});

test("the refusal points at templateId and reads like an instruction", () => {
  const r = createBetBody.safeParse({ ...validBet, templateId: null });
  assert.equal(r.success, false);
  const issue = r.error!.issues[0];
  assert.deepEqual(issue.path, ["templateId"]);
  assert.match(issue.message, /challenge list/i);
});

test("free text still survives in grades and sports", () => {
  for (const category of ["grades", "sports", "custom"]) {
    assert.equal(
      ok(createBetBody, { ...validBet, category, templateId: null }),
      true,
      `${category} lost its free text`
    );
  }
});

test("a non-object body never throws, it just fails", () => {
  for (const bad of [null, undefined, 42, "text", [], true]) {
    assert.doesNotThrow(() => createBetBody.safeParse(bad));
    assert.equal(ok(createBetBody, bad), false);
  }
});
