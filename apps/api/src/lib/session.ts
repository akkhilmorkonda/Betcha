import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * The one place the app asks "who is making this request?".
 *
 * This used to read a bare `bc_user` cookie holding a user id, written by
 * POST /api/session. That cookie was unauthenticated: anything that could set
 * it could become anyone. Both the route and the cookie are gone; identity now
 * comes from a signed Better Auth session.
 *
 * Returns null for a signed-out request. Callers must treat null as
 * "unauthenticated" and refuse — never as "pick a default user".
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** The full session when a route needs the email or name too, not just the id. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
