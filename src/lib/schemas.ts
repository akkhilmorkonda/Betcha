import { z } from "zod";
import { CATEGORIES } from "./categories.ts";
import { MIN_STAKE, MIN_LIABILITY, MAX_LIABILITY } from "./market.ts";
import { MAX_CIRCLE_NAME } from "./circles.ts";

/**
 * The shape of every request body the API accepts.
 *
 * The relative imports below carry explicit .ts extensions because
 * tests/schemas.test.ts reaches this file under node --experimental-strip-types,
 * which does no extension resolution. See the traps section of CLAUDE.md. They
 * are load-bearing; do not "clean them up".
 *
 * Pure and dependency-free apart from the constants they bound against, so the
 * boundary can be tested without a server — and so a limit can never drift
 * between the schema and the engine that enforces it. MIN_STAKE here is the
 * same MIN_STAKE placePosition checks.
 *
 * `.strict()` throughout: an unexpected key is a 400, not something quietly
 * forwarded to Prisma. That is the difference between a typo and a mass
 * assignment.
 */

/** Money is whole cents. A fractional amount is a client bug, not a rounding job. */
const cents = z
  .number()
  .int("must be a whole number of cents")
  .finite()
  .nonnegative();

const cuid = z.string().min(1).max(64);

export const side = z.enum(["A", "B"]);

export const createBetBody = z
  .object({
    circleId: cuid,
    subjectId: cuid,
    category: z.enum(CATEGORIES),
    title: z.string().trim().min(1, "Title cannot be empty").max(140),
    templateId: cuid.nullish(),
    opponentId: cuid.nullish(),
    sideALabel: z.string().trim().max(60).optional(),
    sideBLabel: z.string().trim().max(60).optional(),
    // Accepts what JSON.stringify(new Date()) produces.
    deadline: z.coerce.date().optional(),
    liability: cents.min(MIN_LIABILITY).max(MAX_LIABILITY).optional(),
    proposerSide: side.optional(),
  })
  .strict();

export const placePositionBody = z
  .object({
    side,
    amount: cents.min(MIN_STAKE, `The smallest stake is ${MIN_STAKE} cents`),
  })
  .strict();

export const castVoteBody = z.object({ side }).strict();

export const submitEvidenceBody = z
  .object({
    // The browser downscales before sending. A data: URL is the only thing this
    // endpoint ever legitimately receives — a remote URL here would make the
    // server fetch whatever the caller names.
    imageDataUrl: z
      .string()
      .startsWith("data:image/", "Evidence must be an inline image")
      .max(6_000_000, "That photo is too large — retake it in the app so it gets resized.")
      .nullish(),
  })
  .strict();

export const createCircleBody = z
  .object({ name: z.string().trim().min(1, "Name cannot be empty").max(MAX_CIRCLE_NAME) })
  .strict();
