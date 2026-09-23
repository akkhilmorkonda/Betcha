import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import { prisma } from "./db";
import { anonymizedIdentity, isAnonymized } from "./account-deletion";

/**
 * Scrub one person's identity out of their User row, leaving the row — and
 * therefore the whole circle ledger that points at it — intact.
 *
 * What to write is decided by the pure module; this function only applies it.
 * Derived from the id alone, so it is idempotent and safe to run twice, which
 * it will be: both delete hooks below call it.
 */
async function anonymizeUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { ...anonymizedIdentity(userId), deletedAt: new Date() },
  });
}

/**
 * Better Auth owns identity: the user's credentials, sessions and linked
 * providers. It does NOT own the circle economy — Membership, Rating, Position
 * and Vote stay exactly where they are and keep joining to User.id.
 *
 * Deliberately no `user: { modelName: ... }` here. The adapter already resolves
 * to the Prisma model named `User`, so the existing schema matches with zero
 * config — and on 1.7.3-1.7.5 a capitalized custom modelName trips a
 * false-positive SCHEMA_MISMATCH that fails every auth request. Fixed in 1.7.6,
 * which is not published yet. Leave this alone until it is.
 */
export const auth = betterAuth({
  // Must match datasource db.provider in prisma/schema.prisma. They move
  // together or every auth request fails.
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: { enabled: true },

  // Better Auth owns its own routes, so the app's rateLimit guard never sees
  // them. Sign-in is the one endpoint where unlimited attempts are worth real
  // money to an attacker, so it gets the tightest rule.
  //
  // Storage is in-memory by default, i.e. per-instance and cleared on deploy —
  // same caveat as src/lib/rate-limit.ts, and the same fix later (a shared
  // store) when this runs on more than one box.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      // All three password-reset paths, because each one sends mail. 1.7.5
      // serves /request-password-reset as the primary and keeps
      // /forget-password as a legacy alias — a rule on only one of them leaves
      // the other on the loose global limit.
      "/request-password-reset": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 5 },
    },
  },

  // App Store Guideline 5.1.1(v): an app that creates accounts must let people
  // delete them from inside the app.
  //
  // Deletion here ANONYMIZES; it does not cascade. The User row survives with
  // its identity columns scrubbed, so Membership, Position, Rating, Vote and
  // Bet — other members' financial history — are not touched at all and
  // conservation cannot break. src/lib/account-deletion.ts carries the reasoning
  // and the rules; tests/account-deletion.test.ts holds them.
  //
  // beforeDelete is where the scrub happens. It runs before Better Auth's
  // internalAdapter.deleteUser, which then destroys the Session and Account
  // rows itself — password hash included — and that is exactly what we want.
  // What we do NOT want is the user row delete it attempts last; the
  // databaseHooks.user.delete.before hook below vetoes that.
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await anonymizeUser(user.id);
      },
    },
  },

  // THE VETO, and the reason this is safe rather than merely careful.
  //
  // `deleteUser.beforeDelete` cannot prevent the row delete: better-auth 1.7.5
  // calls the hook and then deletes unconditionally, with no return value
  // consulted (dist/api/routes/update-user.mjs). Throwing is its only
  // interruption, and that would fail the request after the scrub had already
  // committed. A database hook is the one place the delete can be cancelled —
  // getWithHooks treats `false` from delete.before as "skip it"
  // (dist/db/with-hooks.mjs).
  //
  // It is deliberately unconditional: in Betcha a User row is never deleted, by
  // any path, because every ledger relation into it is required and non-null.
  // Anything that reaches here and has not already been scrubbed gets scrubbed,
  // so the guarantee does not depend on which route asked. The schema agrees
  // independently — those relations are onDelete: Restrict, so even a delete
  // issued outside Better Auth fails loudly rather than eating the ledger.
  databaseHooks: {
    user: {
      delete: {
        before: async (user) => {
          if (!isAnonymized(user as Parameters<typeof isAnonymized>[0])) {
            await anonymizeUser(user.id);
          }
          return false;
        },
      },
    },
  },

  // Sign in with Apple. Credentials aren't provisioned yet, and Apple refuses
  // localhost and non-HTTPS callbacks, so this cannot be exercised until there
  // is a real domain. Shape is correct for when it can be.
  //
  // socialProviders: {
  //   apple: {
  //     clientId: process.env.APPLE_CLIENT_ID as string,      // Service ID (web)
  //     clientSecret: process.env.APPLE_CLIENT_SECRET as string, // ES256 JWT you sign
  //     appBundleIdentifier: process.env.APPLE_BUNDLE_ID,     // native iOS client
  //   },
  // },
  // trustedOrigins: ["https://appleid.apple.com"],

  // Which origins may drive the auth endpoints. The native app identifies
  // itself by its custom scheme, which must match expo.scheme in
  // apps/mobile/app.json and the scheme passed to expoClient().
  //
  // The exp:// entries are Expo Go / dev-client URLs and are DEVELOPMENT ONLY.
  // They are wildcards, and a wildcard origin allowlist is exactly what was
  // deleted from next.config.mjs — anyone can register a subdomain. Gating them
  // on NODE_ENV is what keeps that deletion meaningful.
  trustedOrigins: [
    "betcha://",
    ...(process.env.NODE_ENV === "development" ? ["exp://", "exp://**"] : []),
  ],

  // expo() before nextCookies(): nextCookies must stay last in the array.
  plugins: [expo(), nextCookies()],
});
