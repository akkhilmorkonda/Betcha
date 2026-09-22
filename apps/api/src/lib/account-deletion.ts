/**
 * WHAT "DELETE MY ACCOUNT" MEANS IN A SHARED LEDGER.
 *
 * App Store Guideline 5.1.1(v) requires in-app account deletion. The naive
 * reading — drop the User row — is wrong here, and was a live landmine:
 * Membership, Position, Rating and Vote all declared `onDelete: Cascade`
 * against User, so deleting one person destroyed OTHER members' financial
 * history, and Bet.creator/subject/opponent are required relations that would
 * RESTRICT and fail the delete outright for anyone who had ever been in a bet.
 *
 * WHY THE ROW SURVIVES, ANONYMIZED, RATHER THAN BEING REMOVED.
 *
 * Every ledger foreign key into User is required and non-null. Removing the row
 * leaves exactly two options, and both are worse:
 *
 *   1. Cascade. Deletes other members' positions and votes. Money that was
 *      staked and paid out vanishes from one side of the books, so invariant 4
 *      (conservation) breaks by construction. Non-starter.
 *
 *   2. Repoint the relations at a shared "deleted user" tombstone. Rewrites
 *      Bet rows that other members are still holding positions on, so their
 *      history is no longer what it was — and it does not even work: Position
 *      is unique on [betId, userId] and Vote on [resolutionId, userId], so the
 *      second person to delete their account collides with the first on any bet
 *      they both touched, and their deletion fails.
 *
 * So the row stays and is scrubbed in place. That mutates exactly one row — the
 * departing person's own identity columns — and touches no money column at all,
 * which is what makes the guarantee absolute rather than merely careful: every
 * other row in the database is byte-identical before and after. Conservation
 * cannot break because nothing that holds money is read or written.
 *
 * 5.1.1(v) is satisfied because the personal data is genuinely gone: name,
 * email, avatar seed and image are overwritten here, and Better Auth deletes
 * the Session and Account rows (including the password hash) itself, before our
 * veto on the row delete ever runs. What remains is a userId — an opaque cuid
 * that was already scattered across the ledger rows we are deliberately keeping
 * — and money figures that belong to the circle, not to the person.
 *
 * Pure on purpose. No Prisma, no Better Auth. The rule is a thing the test suite
 * can hold, not an `if` buried in a transaction. `src/lib/auth.ts` is the only
 * caller; it applies what this module decides.
 */

/**
 * The reserved-by-RFC-2606 domain. `.invalid` can never resolve, so a scrubbed
 * address can never route mail to a real inbox even if something later tries.
 */
export const ANONYMIZED_EMAIL_DOMAIN = "deleted.invalid";

/** What the feed, standings and bet detail render where a name used to be. */
export const ANONYMIZED_NAME = "Deleted member";

/**
 * Hex, rather than the raw id, because `User.email` carries a unique index: two
 * anonymized addresses colliding would make the SECOND person's deletion fail
 * at the database. Hex encoding is injective for any well-formed string, so
 * distinct ids give distinct addresses, and it cannot produce an invalid local
 * part no matter what the id contains.
 *
 * UTF-8 rather than UTF-16 for length: a 25-character cuid becomes 50 hex
 * characters, which with the prefix fits RFC 5321's 64-octet local part. UTF-16
 * would double that and overflow it.
 *
 * The one boundary: TextEncoder maps every unpaired surrogate to U+FFFD, so two
 * different lone surrogates would collide. Unreachable here — a user id is a
 * cuid, `[a-z0-9]+`, and nothing lets a caller pick their own — and pinned by a
 * test in tests/account-deletion.test.ts so it stays a known limit rather than
 * a surprise.
 *
 * TextEncoder rather than Buffer so this module stays portable between the Next
 * bundle and the bare `node --experimental-strip-types` the tests run under.
 */
function toHex(value: string): string {
  let out = "";
  for (const byte of new TextEncoder().encode(value)) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/** Stable, collision-free, and derived from nothing the person typed. */
export function anonymizedEmail(userId: string): string {
  return `deleted-${toHex(userId)}@${ANONYMIZED_EMAIL_DOMAIN}`;
}

/** The identity columns of a scrubbed User row. */
export type AnonymizedIdentity = {
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  avatarSeed: string;
};

/**
 * Everything a scrubbed User row should contain, derived from the id ALONE.
 *
 * Deriving from the id and nothing else buys idempotency: running this twice
 * produces the identical row. That matters because two independent paths call
 * it — the `deleteUser.beforeDelete` hook and the `databaseHooks.user.delete`
 * backstop — and either may run without the other.
 */
export function anonymizedIdentity(userId: string): AnonymizedIdentity {
  return {
    name: ANONYMIZED_NAME,
    email: anonymizedEmail(userId),
    emailVerified: false,
    image: null,
    avatarSeed: "",
  };
}

/** Has this row already been scrubbed? The backstop hook uses it to stay cheap. */
export function isAnonymized(
  user: { id: string } & Partial<AnonymizedIdentity> & { deletedAt?: Date | null }
): boolean {
  if (!user.deletedAt) return false;
  const want = anonymizedIdentity(user.id);
  return (
    user.name === want.name &&
    user.email === want.email &&
    user.emailVerified === want.emailVerified &&
    (user.image ?? null) === want.image &&
    user.avatarSeed === want.avatarSeed
  );
}

/**
 * WHAT HAPPENS TO EVERY TABLE, STATED ONCE.
 *
 * "purged" rows are destroyed, "anonymized" rows are scrubbed in place,
 * "retained" rows are not touched at all. The test suite asserts that this
 * covers every model in schema.prisma, so adding a table without deciding what
 * deletion does to it fails the build rather than quietly leaking.
 */
export type Disposition = "purged" | "anonymized" | "retained";

export const DELETION_PLAN: Readonly<Record<string, Disposition>> = {
  // Identity. Better Auth's own internalAdapter.deleteUser removes the Session
  // and Account rows before our veto runs, which is exactly right: the password
  // hash and every live session go, so the person can never sign in again.
  Session: "purged",
  Account: "purged",
  Verification: "purged",

  // The person themselves: scrubbed, not removed.
  User: "anonymized",

  // The ledger. None of this is the departing person's alone to destroy.
  Membership: "retained",
  Position: "retained",
  Rating: "retained",
  Vote: "retained",
  Bet: "retained",
  Resolution: "retained",
  EloEvent: "retained",
  Circle: "retained",
  ChallengeTemplate: "retained",
};

/**
 * Tables holding integer cents, or the Elo that prices them. If any of these is
 * ever marked "purged", conservation is gone and so is the product.
 */
export const MONEY_BEARING_MODELS: readonly string[] = [
  "Membership", // balance
  "Position", // amount, payout, balanceAtEntry
  "Bet", // proposerLiability
];

export function dispositionOf(model: string): Disposition | null {
  return Object.prototype.hasOwnProperty.call(DELETION_PLAN, model)
    ? DELETION_PLAN[model]
    : null;
}

/** Does deleting an account destroy any row of this model? */
export function isPurged(model: string): boolean {
  return dispositionOf(model) === "purged";
}
