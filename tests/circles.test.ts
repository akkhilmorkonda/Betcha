import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInviteCode,
  isWellFormedInviteCode,
  generateInviteCode,
  validateCircleName,
  canJoinCircle,
  INVITE_CODE_LENGTH,
  MAX_CIRCLE_NAME,
  MAX_CIRCLE_MEMBERS,
} from "../src/lib/circles.ts";
import { mulberry32 } from "../src/lib/rng.ts";

test("invite codes are matched case-insensitively", () => {
  assert.equal(normalizeInviteCode("hackmit"), "HACKMIT");
  assert.equal(normalizeInviteCode("HaCkMiT"), "HACKMIT");
});

test("a code pasted out of a chat message survives the whitespace", () => {
  assert.equal(normalizeInviteCode("  ABC234 \n"), "ABC234");
});

test("generated codes never contain the characters people misread", () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 2000; i++) {
    const code = generateInviteCode(rand);
    for (const bad of ["I", "O", "0", "1"]) {
      assert.ok(!code.includes(bad), `code ${code} contains ambiguous ${bad}`);
    }
  }
});

test("FUZZ: every generated code passes its own well-formedness check", () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 5000; i++) {
    const code = generateInviteCode(rand);
    assert.equal(code.length, INVITE_CODE_LENGTH);
    assert.ok(isWellFormedInviteCode(code), `generated code ${code} rejected itself`);
    assert.ok(isWellFormedInviteCode(code.toLowerCase()), `lowercase ${code} rejected`);
  }
});

test("generation is deterministic under a pinned rng", () => {
  assert.equal(generateInviteCode(mulberry32(1)), generateInviteCode(mulberry32(1)));
});

test("malformed codes are rejected before any database work", () => {
  for (const bad of ["", "ABC", "TOOLONGCODE", "ABC-23", "ABC 23", "ABCI23", "ABC023"]) {
    assert.equal(isWellFormedInviteCode(bad), false, `${bad} should be rejected`);
  }
});

test("circle names are trimmed, and the trimmed form is what gets stored", () => {
  const r = validateCircleName("  The Group Chat  ");
  assert.deepEqual(r, { ok: true, name: "The Group Chat" });
});

test("a whitespace-only name is empty, not valid", () => {
  assert.equal(validateCircleName("   ").ok, false);
});

test("names are bounded, and the boundary itself is allowed", () => {
  assert.equal(validateCircleName("x".repeat(MAX_CIRCLE_NAME)).ok, true);
  assert.equal(validateCircleName("x".repeat(MAX_CIRCLE_NAME + 1)).ok, false);
});

test("a non-string name never throws", () => {
  for (const bad of [null, undefined, 42, {}, [], true]) {
    assert.equal(validateCircleName(bad).ok, false);
  }
});

test("joining a circle that does not exist is a 404, not a crash", () => {
  const r = canJoinCircle({ circleExists: false, alreadyMember: false, memberCount: 0 });
  assert.deepEqual(r, { ok: false, reason: "No such circle", status: 404 });
});

test("tapping the same invite twice does not create a second membership", () => {
  const r = canJoinCircle({ circleExists: true, alreadyMember: true, memberCount: 3 });
  assert.equal(r.ok, false);
  assert.equal((r as { status: number }).status, 409);
});

test("a full circle refuses new members at exactly the cap", () => {
  assert.equal(
    canJoinCircle({ circleExists: true, alreadyMember: false, memberCount: MAX_CIRCLE_MEMBERS }).ok,
    false
  );
  assert.equal(
    canJoinCircle({ circleExists: true, alreadyMember: false, memberCount: MAX_CIRCLE_MEMBERS - 1 }).ok,
    true
  );
});

test("an existing member is refused even when the circle is full", () => {
  const r = canJoinCircle({
    circleExists: true,
    alreadyMember: true,
    memberCount: MAX_CIRCLE_MEMBERS,
  });
  assert.equal(r.ok, false);
});
