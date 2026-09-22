/**
 * Circle creation and joining — the pure half.
 *
 * No Prisma here. Everything in this file is a total function over its inputs so
 * the rules can be fuzzed, exactly like market.ts and eligibility.ts. The route
 * handlers in src/app/api/circle/ do the IO and call into these.
 */

/** A fresh member's opening bankroll, in whole currency units. */
export const STARTING_BALANCE = 120;

export const INVITE_CODE_LENGTH = 6;

/**
 * Deliberately missing I, O, 0 and 1. Invite codes get read aloud and typed
 * from a screenshot, and those four are the pairs people get wrong.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MAX_CIRCLE_NAME = 40;
export const MAX_CIRCLE_MEMBERS = 50;

/**
 * Codes are matched case-insensitively and stored uppercase. Users paste them
 * out of chat messages with stray whitespace, so strip that too.
 */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** True when `raw` could be a code at all. Cheap reject before touching the DB. */
export function isWellFormedInviteCode(raw: string): boolean {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_CODE_LENGTH) return false;
  for (const ch of code) if (!ALPHABET.includes(ch)) return false;
  return true;
}

/**
 * `rand` is injected rather than calling Math.random directly, so tests can pin
 * it and the generator stays pure. Pass mulberry32(seed) for a repeatable code.
 */
export function generateInviteCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const idx = Math.floor(rand() * ALPHABET.length) % ALPHABET.length;
    out += ALPHABET[idx];
  }
  return out;
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Trims, then bounds. Returns the cleaned name so callers store the trimmed form. */
export function validateCircleName(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, reason: "Name must be text" };
  const name = raw.trim();
  if (name.length === 0) return { ok: false, reason: "Name cannot be empty" };
  if (name.length > MAX_CIRCLE_NAME) {
    return { ok: false, reason: `Name cannot exceed ${MAX_CIRCLE_NAME} characters` };
  }
  return { ok: true, name };
}

export type JoinCheck = { ok: true } | { ok: false; reason: string; status: number };

/**
 * Whether `userId` may join a circle, given what the DB already knows about it.
 * Pure so the rule is fuzzable; the route supplies the facts.
 *
 * Re-joining is not an error the caller needs to recover from — it's the normal
 * result of tapping an invite link twice — but it must not create a second
 * Membership, and it must never reset an existing balance.
 */
export function canJoinCircle(args: {
  circleExists: boolean;
  alreadyMember: boolean;
  memberCount: number;
}): JoinCheck {
  if (!args.circleExists) return { ok: false, reason: "No such circle", status: 404 };
  if (args.alreadyMember) return { ok: false, reason: "Already a member", status: 409 };
  if (args.memberCount >= MAX_CIRCLE_MEMBERS) {
    return { ok: false, reason: "Circle is full", status: 409 };
  }
  return { ok: true };
}
