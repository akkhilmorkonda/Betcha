/**
 * The shared core: everything both the API and the future Expo client need.
 *
 * Nothing in here touches Prisma, `next/*`, or any Node built-in, which is what
 * makes it importable from a React Native bundle. Server-only modules — bets,
 * auth, session, moderation, spark, rate limiting — deliberately stay in the app.
 *
 * The `.ts` specifiers are load-bearing: the test runner uses
 * `node --experimental-strip-types`, which does no extension resolution. Metro
 * and the Next bundler both resolve them fine — measured, see CLAUDE.md.
 */
export * from "./market.ts";
export * from "./format.ts";
export * from "./categories.ts";
export * from "./circles.ts";
export * from "./eligibility.ts";
export * from "./rng.ts";
export * from "./templates.ts";
export * from "./schemas.ts";
export * from "./avatar.ts";
