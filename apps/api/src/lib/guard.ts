import { NextResponse } from "next/server";
import { z } from "zod";
import { POLICIES, hit, sweep, type Action, type RateStore } from "./rate-limit";

/**
 * The gate every mutating route goes through: validate the body, then spend a
 * rate-limit token. Both halves live here so no route can remember one and
 * forget the other.
 */

// One store for the process. See rate-limit.ts on why this is per-instance.
const store: RateStore = new Map();
const MAX_WINDOW = Math.max(...Object.values(POLICIES).map((p) => p.windowMs));
let lastSweep = 0;

/**
 * Who to count against. A signed-in user is counted by id, so rotating IPs
 * does not buy extra quota. Anonymous callers fall back to IP.
 *
 * x-forwarded-for is client-controlled unless a trusted proxy overwrites it, so
 * this is a speed bump for anonymous abuse, not an identity. Everything that
 * matters here is authenticated first and counted by user id.
 */
export function identify(req: Request, userId: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/** 429 with Retry-After, or null when the caller is within their quota. */
export function rateLimit(
  req: Request,
  userId: string | null,
  action: Action,
  now = Date.now()
): NextResponse | null {
  if (now - lastSweep > MAX_WINDOW) {
    sweep(store, now, MAX_WINDOW);
    lastSweep = now;
  }

  const policy = POLICIES[action];
  const result = hit(store, `${action}:${identify(req, userId)}`, policy, now);
  if (result.ok) return null;

  const seconds = Math.ceil(result.retryAfterMs / 1000);
  return NextResponse.json(
    { error: `Too many requests. Try again in ${seconds}s.` },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}

/** Test seam. The app never calls this. */
export function __resetRateLimits() {
  store.clear();
  lastSweep = 0;
}

/**
 * Parse and validate a JSON body.
 *
 * Returns either the typed value or a ready-to-send 400. Routes used to
 * destructure `await req.json()` directly, which meant a non-JSON body threw a
 * 500 and an unexpected field was passed straight through to Prisma.
 */
export async function readBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Body must be JSON" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // One human-readable message. The full issue list is not echoed back: it
    // describes the server's shape to anyone probing.
    const first = parsed.error.issues[0];
    const where = first.path.length ? `${first.path.join(".")}: ` : "";
    return {
      ok: false,
      response: NextResponse.json({ error: `${where}${first.message}` }, { status: 400 }),
    };
  }

  return { ok: true, data: parsed.data };
}
