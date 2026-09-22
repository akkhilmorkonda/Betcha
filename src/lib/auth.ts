import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";

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
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: { enabled: true },

  // App Store Guideline 5.1.1(v): an app that creates accounts must let people
  // delete them from inside the app. Enabling the flag is the easy half.
  //
  // THE HARD HALF IS NOT DONE YET. Membership, Position, Rating and Vote all
  // declare onDelete: Cascade against User, so deleting a user today would also
  // delete their bet positions and votes — which are other members' financial
  // history, not just theirs. Worse, Bet.creator/subject/opponent are required
  // relations with no onDelete rule, so Postgres would RESTRICT and the delete
  // would simply fail for anyone who has ever been in a bet.
  //
  // The fix is a beforeDelete hook that anonymizes rather than cascades. Wire it
  // before shipping the delete button. See claude/app-store-readiness.md.
  user: { deleteUser: { enabled: true } },

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

  plugins: [nextCookies()], // must stay last in the array
});
