import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret } from "../src/lib/spark.ts";

const grounded = ["Watch face reads 4.98 mi", "Elapsed time shows 38:42"];

test("a clearly-true verdict with observations auto-resolves to A", () => {
  const r = interpret({ verdict: "clearly_true", confidence: 0.93, claim: "x", observations: grounded });
  assert.equal(r.autoOutcome, "A");
});

test("a clearly-false verdict with observations auto-resolves to B", () => {
  const r = interpret({ verdict: "clearly_false", confidence: 0.9, claim: "x", observations: grounded });
  assert.equal(r.autoOutcome, "B");
});

test("a confident verdict with NO observations never auto-resolves", () => {
  const r = interpret({ verdict: "clearly_true", confidence: 0.99, claim: "x", observations: [] });
  assert.equal(r.autoOutcome, null);
  assert.match(r.reason, /concrete detail/);
});

test("probably_true goes to a vote no matter how high the float is", () => {
  const r = interpret({ verdict: "probably_true", confidence: 0.97, claim: "x", observations: grounded });
  assert.equal(r.autoOutcome, null);
});

test("unclear goes to a vote", () => {
  assert.equal(interpret({ verdict: "unclear", confidence: 0.5, observations: grounded }).autoOutcome, null);
});

test("a garbage or missing verdict degrades to unclear, never to an outcome", () => {
  for (const bad of [undefined, null, "yes", 42, {}]) {
    const r = interpret({ verdict: bad, confidence: 1, observations: grounded });
    assert.equal(r.verdict, "unclear");
    assert.equal(r.autoOutcome, null);
  }
});

test("a malformed payload does not throw", () => {
  const r = interpret({});
  assert.equal(r.available, true);
  assert.equal(r.autoOutcome, null);
  assert.equal(r.confidence, 0);
});

test("confidence is clamped into [0,1]", () => {
  assert.equal(interpret({ verdict: "unclear", confidence: 4.2, observations: [] }).confidence, 1);
  assert.equal(interpret({ verdict: "unclear", confidence: -3, observations: [] }).confidence, 0);
});

test("non-string observations are discarded", () => {
  const r = interpret({ verdict: "clearly_true", confidence: 0.9, observations: [1, null, "real detail"] });
  assert.deepEqual(r.observations, ["real detail"]);
});

/**
 * Real Muse Spark response, captured 2026-09-19 from muse-spark-1.3.
 * A photo of someone beside a fridge, submitted against "Akkhil runs 5 miles
 * under 40 minutes". The model returned confidence 0.99 — and verdict unclear.
 *
 * Under a confidence threshold of 0.8 this photo settles the bet and pays out.
 * This test exists so nobody ever reintroduces that gate.
 */
const FRIDGE_PHOTO = {
  claim:
    "A person with long dark hair wearing a white T-shirt stands next to a white refrigerator marked with a red drawing of two faces, a heart, and the text DS + A.",
  observations: [
    "White refrigerator with handles on the left occupies most of the background",
    "Red text reading 'DS + A' drawn on the upper refrigerator door",
    "Red marker drawing of two smiling cartoon faces with a heart below them",
    "Person with long dark hair, gold hoop earrings, heart pendant necklace, and white T-shirt with partial text 'NEW EN' in the foreground",
    "No running distance, time, stopwatch, fitness app, bib, timestamp, or name Akkhil visible",
    "Kitchen setting with a black microwave on top of the refrigerator",
  ],
  verdict: "unclear",
  confidence: 0.99,
};

test("REGRESSION: a 0.99-confidence unrelated photo must not settle a bet", () => {
  const r = interpret(FRIDGE_PHOTO);
  assert.equal(r.verdict, "unclear");
  assert.equal(r.confidence, 0.99);
  assert.equal(r.autoOutcome, null, "0.99 confidence must not pay anyone out");
  assert.match(r.reason, /not conclusive/);
});

test("a high float can never override the verdict, at any value", () => {
  for (const confidence of [0.8, 0.9, 0.99, 1]) {
    for (const verdict of ["unclear", "probably_true", "probably_false"]) {
      assert.equal(
        interpret({ ...FRIDGE_PHOTO, verdict, confidence }).autoOutcome,
        null,
        `${verdict} at ${confidence} must still go to a vote`
      );
    }
  }
});

test("the model's negative observations still count as grounding", () => {
  // "No stopwatch visible" is evidence it checked, so a clear verdict backed by
  // observations like these is trustworthy.
  const r = interpret({ ...FRIDGE_PHOTO, verdict: "clearly_false", confidence: 0.91 });
  assert.equal(r.autoOutcome, "B");
});
