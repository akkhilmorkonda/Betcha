import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  anonymizedEmail,
  anonymizedIdentity,
  isAnonymized,
  dispositionOf,
  isPurged,
  DELETION_PLAN,
  MONEY_BEARING_MODELS,
  ANONYMIZED_NAME,
  ANONYMIZED_EMAIL_DOMAIN,
} from "../src/lib/account-deletion.ts";
import { mulberry32 } from "@betcha/core";

/**
 * THE INVARIANT: deleting your account removes YOU and nothing else.
 *
 * The personal data must genuinely go, or the App Store requirement is not met.
 * The ledger must genuinely stay, or invariant 4 — conservation — breaks and
 * other members lose history they did not consent to lose. Those two pull in
 * opposite directions and this file is where the line between them is held.
 */

const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
const schema = readFileSync(schemaPath, "utf8");

// ---------------------------------------------------------------- identity

test("the scrubbed row keeps nothing the person typed", () => {
  const id = "u_abc123";
  const scrubbed = anonymizedIdentity(id);

  assert.equal(scrubbed.name, ANONYMIZED_NAME);
  assert.equal(scrubbed.image, null);
  assert.equal(scrubbed.avatarSeed, "");
  assert.equal(scrubbed.emailVerified, false);
  assert.ok(scrubbed.email.endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`));
});

test("the scrubbed address is on a domain that can never receive mail", () => {
  // RFC 2606 reserves .invalid precisely so it cannot resolve. If this ever
  // becomes a real domain, a deleted account becomes a deliverable mailbox.
  assert.ok(ANONYMIZED_EMAIL_DOMAIN.endsWith(".invalid"));
});

test("anonymizing is idempotent, because two hooks both call it", () => {
  // beforeDelete scrubs, and the databaseHooks backstop scrubs again if it has
  // to. Running twice must not produce a second, different row.
  const id = "u_xyz";
  assert.deepEqual(anonymizedIdentity(id), anonymizedIdentity(id));
  assert.equal(anonymizedEmail(id), anonymizedEmail(id));
});

test("isAnonymized recognizes a scrubbed row and rejects a live one", () => {
  const id = "u_live";
  const scrubbed = { id, ...anonymizedIdentity(id), deletedAt: new Date() };
  assert.equal(isAnonymized(scrubbed), true);

  assert.equal(
    isAnonymized({
      id,
      name: "Real Person",
      email: "real@example.com",
      emailVerified: true,
      image: "https://example.com/a.png",
      avatarSeed: "seed",
      deletedAt: null,
    }),
    false
  );
});

test("a row with deletedAt set but identity still present is NOT anonymized", () => {
  // The marker alone must not be enough to satisfy the backstop, or a
  // half-finished scrub would be mistaken for a finished one and left leaking.
  const id = "u_half";
  assert.equal(
    isAnonymized({
      id,
      name: "Real Person",
      email: anonymizedEmail(id),
      emailVerified: false,
      image: null,
      avatarSeed: "",
      deletedAt: new Date(),
    }),
    false
  );
});

test("a fully scrubbed row without the marker is NOT anonymized either", () => {
  const id = "u_nomark";
  assert.equal(isAnonymized({ id, ...anonymizedIdentity(id), deletedAt: null }), false);
});

test("isAnonymized treats a missing image the same as an explicitly null one", () => {
  const id = "u_img";
  const { image: _drop, ...rest } = anonymizedIdentity(id);
  assert.equal(isAnonymized({ id, ...rest, deletedAt: new Date() }), true);
});

// ------------------------------------------------------------------- plan

test("every model in schema.prisma has a decided disposition", () => {
  // A new table must not be able to slip in without someone deciding whether
  // deleting an account destroys it. This is the whole point of the plan.
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  assert.ok(models.length > 5, `only found ${models.length} models — regex broke`);

  for (const model of models) {
    assert.notEqual(
      dispositionOf(model),
      null,
      `model ${model} has no entry in DELETION_PLAN`
    );
  }

  // And nothing in the plan refers to a table that no longer exists.
  for (const planned of Object.keys(DELETION_PLAN)) {
    assert.ok(models.includes(planned), `DELETION_PLAN names missing model ${planned}`);
  }
});

test("nothing that holds money is ever purged", () => {
  for (const model of MONEY_BEARING_MODELS) {
    assert.equal(
      dispositionOf(model),
      "retained",
      `${model} holds money and must be retained, not ${dispositionOf(model)}`
    );
  }
});

test("only identity tables are purged", () => {
  const purged = Object.keys(DELETION_PLAN).filter(isPurged);
  assert.deepEqual(purged.sort(), ["Account", "Session", "Verification"]);
});

test("the User row is anonymized, never purged", () => {
  assert.equal(dispositionOf("User"), "anonymized");
  assert.equal(isPurged("User"), false);
});

test("an unknown model has no disposition rather than a default one", () => {
  assert.equal(dispositionOf("NotAModel"), null);
  assert.equal(isPurged("NotAModel"), false);
});

test("dispositionOf is not fooled by inherited Object properties", () => {
  // DELETION_PLAN is a plain object literal, so "constructor" and "toString"
  // are reachable on its prototype. A naive lookup would return a function.
  for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.equal(dispositionOf(key), null, `${key} leaked through`);
  }
});

// ----------------------------------------------------------------- schema

test("REGRESSION: no ledger table cascades from User", () => {
  /**
   * This is the landmine the whole change exists to defuse. Membership,
   * Position, Rating and Vote each used to declare onDelete: Cascade against
   * User, so deleting one person deleted other members' positions and votes —
   * money out of the books with nothing balancing it.
   *
   * Asserted against the schema text rather than a mock, because the schema IS
   * the rule. A Prisma model mocked in a test would prove nothing.
   */
  const ledger = ["Membership", "Rating", "Position", "Vote"];

  for (const model of ledger) {
    const block = schema.match(new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, "m"));
    assert.ok(block, `could not find model ${model} in schema.prisma`);

    const userRelation = block[1]
      .split("\n")
      .find((line) => /\buser\s+User\b/.test(line));
    assert.ok(userRelation, `model ${model} has no user User relation`);

    assert.ok(
      /onDelete:\s*Restrict/.test(userRelation),
      `${model}.user must be onDelete: Restrict, got: ${userRelation.trim()}`
    );
  }
});

test("REGRESSION: Bet's three user relations all restrict", () => {
  // creator and subject already defaulted to Restrict, but `opponent` is
  // optional and therefore defaulted to SetNull — which would have blanked the
  // opponent out of a head-to-head other members still held positions on.
  const block = schema.match(/^model\s+Bet\s*\{([\s\S]*?)^\}/m);
  assert.ok(block, "could not find model Bet");

  for (const field of ["creator", "subject", "opponent"]) {
    const line = block[1]
      .split("\n")
      .find((l) => new RegExp(`^\\s*${field}\\s+User`).test(l));
    assert.ok(line, `Bet.${field} not found`);
    assert.ok(
      /onDelete:\s*Restrict/.test(line),
      `Bet.${field} must be onDelete: Restrict, got: ${line.trim()}`
    );
  }
});

test("the User row carries a deletedAt marker", () => {
  const block = schema.match(/^model\s+User\s*\{([\s\S]*?)^\}/m);
  assert.ok(block, "could not find model User");
  assert.ok(
    /deletedAt\s+DateTime\?/.test(block[1]),
    "User.deletedAt must exist and be nullable"
  );
});

// ------------------------------------------------------------------- fuzz

test("FUZZ: distinct users never collide on the scrubbed email", () => {
  /**
   * User.email carries a unique index. If two anonymized addresses collide,
   * the SECOND person to delete their account gets a constraint violation and
   * cannot delete it at all — a 5.1.1(v) failure that would only ever show up
   * in production, on the unlucky second user.
   *
   * So: injectivity, over ids far nastier than the cuids Prisma actually
   * generates. Anything that can reach a user id must map to a distinct,
   * well-formed local part.
   */
  const rand = mulberry32(90210);
  // Spread into code points, not UTF-16 units: indexing the string directly
  // would hand out half of the 🎲 surrogate pair, and a lone surrogate is not a
  // well-formed string. See the boundary test below for what happens then.
  const alphabet = [..."abcdefghijklmnopqrstuvwxyz0123456789_-@. +'\"\\/%#&é漢🎲"];
  const seen = new Map<string, string>();

  for (let i = 0; i < 20_000; i++) {
    const len = 1 + Math.floor(rand() * 12);
    let id = "";
    for (let c = 0; c < len; c++) {
      id += alphabet[Math.floor(rand() * alphabet.length)];
    }

    const email = anonymizedEmail(id);

    const prior = seen.get(email);
    if (prior !== undefined) {
      assert.equal(prior, id, `collision: ${JSON.stringify(prior)} vs ${JSON.stringify(id)}`);
    } else {
      seen.set(email, id);
    }

    // The local part must stay a legal, unambiguous atom no matter the input:
    // exactly one @, and nothing needing quoting.
    assert.match(email, /^deleted-[0-9a-f]+@deleted\.invalid$/);
    assert.equal(email.split("@").length, 2);
  }

  assert.ok(seen.size > 10_000, `only ${seen.size} distinct ids generated`);
});

test("a cuid's scrubbed address stays inside the 64-character local part limit", () => {
  // RFC 5321 caps the local part at 64 octets. Prisma's cuid is 25 characters,
  // which hex-encodes to 50, plus the 8-character "deleted-" prefix. That is 58
  // — comfortable, but not so comfortable that a switch to a longer id scheme
  // could not overflow it silently.
  const cuid = "clh3k9x2p0000qwer8sdf1234x";
  const local = anonymizedEmail(cuid).split("@")[0];
  assert.ok(local.length <= 64, `local part is ${local.length} characters`);
});

test("BOUNDARY: injectivity holds for well-formed strings, not lone surrogates", () => {
  /**
   * Documented rather than hidden, because the fuzzer found it. TextEncoder
   * maps every unpaired surrogate to U+FFFD, so two different lone surrogates
   * hex-encode identically and would collide on User.email.
   *
   * Unreachable in practice: a user id is a Prisma cuid, `[a-z0-9]+`, and
   * nothing in the app lets a caller choose their own id. If that ever stops
   * being true, this test is the thing that says what breaks.
   */
  assert.equal(anonymizedEmail("\ud83c"), anonymizedEmail("\udfb2"));

  // The paired form, which is a well-formed string, is unaffected.
  assert.notEqual(anonymizedEmail("🎲"), anonymizedEmail("\ud83c"));
});

test("FUZZ: the scrubbed row never echoes the identity it replaced", () => {
  /**
   * The scrub is derived from the user id alone, so no part of the name, email,
   * image URL or avatar seed can survive into it. Stated as a property over
   * random personal data rather than trusting the implementation to have
   * forgotten to copy something.
   */
  const rand = mulberry32(4242);
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
  const firsts = ["Ada", "Bo", "Cyrus", "Dee", "Ev", "Fenwick", "Gus"];
  const lasts = ["Lovelace", "Nakamura", "O'Hara", "Patel", "Quinn", "Reyes"];

  for (let i = 0; i < 5000; i++) {
    const id = `u_${Math.floor(rand() * 1e9).toString(36)}`;
    const name = `${pick(firsts)} ${pick(lasts)}`;
    const email = `${name.replace(/\W/g, "").toLowerCase()}@${pick(["gmail.com", "mit.edu"])}`;
    const image = `https://cdn.example.com/${name.replace(/\W/g, "")}.png`;
    const avatarSeed = name.toLowerCase();

    const scrubbed = anonymizedIdentity(id);
    const rendered = JSON.stringify(scrubbed).toLowerCase();

    // No token of the original identity appears anywhere in the result.
    for (const secret of [name, email, image, avatarSeed]) {
      for (const token of secret.split(/[\s@./]+/).filter((t) => t.length >= 3)) {
        assert.ok(
          !rendered.includes(token.toLowerCase()),
          `scrubbed row leaked ${JSON.stringify(token)} from ${JSON.stringify(secret)}`
        );
      }
    }

    // And the result is a row isAnonymized will accept, so the backstop hook
    // recognizes its own work and does not scrub in a loop.
    assert.equal(isAnonymized({ id, ...scrubbed, deletedAt: new Date() }), true);
  }
});
