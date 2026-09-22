/**
 * Request rate limiting.
 *
 * The counting is a pure function over a store you pass in, so the policy is
 * testable without a server, a clock or a network — same reason market.ts and
 * eligibility.ts are shaped the way they are.
 *
 * WHAT THIS IS NOT. The store is an in-process Map. It is per-instance, so two
 * Next servers behind a load balancer each allow the full quota, and it resets
 * on deploy. That is an honest fit for one container; it is NOT a fit for
 * serverless, where every cold start is a fresh quota. When this moves to a
 * platform that scales horizontally, the store goes to Redis and only
 * `hit` below changes — the policy and its tests do not.
 */

/** A sliding window log: the timestamps of recent hits for one key. */
export type RateStore = Map<string, number[]>;

export interface Policy {
  /** Hits allowed inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  /** Milliseconds until the caller may retry. 0 when ok. */
  retryAfterMs: number;
}

/**
 * The policies, one per action rather than one global number, because the costs
 * are not comparable. Evidence submission calls a vision model and can settle a
 * bet; reading a circle does neither.
 */
export const POLICIES = {
  createBet: { limit: 10, windowMs: 60_000 },
  placePosition: { limit: 30, windowMs: 60_000 },
  castVote: { limit: 20, windowMs: 60_000 },
  // Deliberately the tightest: it calls a paid model and can resolve a bet,
  // paying out real positions.
  submitEvidence: { limit: 5, windowMs: 60_000 },
  // Circle creation is cheap for the caller and permanent for everyone else.
  createCircle: { limit: 5, windowMs: 600_000 },
  joinCircle: { limit: 20, windowMs: 600_000 },
} as const satisfies Record<string, Policy>;

export type Action = keyof typeof POLICIES;

/**
 * Record a hit and say whether it is allowed.
 *
 * Pure apart from mutating the store it is handed. Expired timestamps are
 * dropped on read, so the store does not grow without bound for an active key.
 * A key nobody touches again lingers until `sweep` runs.
 */
export function hit(
  store: RateStore,
  key: string,
  policy: Policy,
  now: number
): RateResult {
  const cutoff = now - policy.windowMs;
  const recent = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= policy.limit) {
    // Retry when the oldest hit in the window falls out of it.
    const retryAfterMs = Math.max(1, recent[0] + policy.windowMs - now);
    // Do NOT record this hit. Counting refused requests would let a caller
    // hammering the endpoint hold their own window open indefinitely.
    store.set(key, recent);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  recent.push(now);
  store.set(key, recent);
  return { ok: true, remaining: policy.limit - recent.length, retryAfterMs: 0 };
}

/** Drop keys with no live hits. Call periodically; cheap and optional. */
export function sweep(store: RateStore, now: number, maxWindowMs: number): number {
  const cutoff = now - maxWindowMs;
  let dropped = 0;
  for (const [key, hits] of store) {
    if (hits.every((t) => t <= cutoff)) {
      store.delete(key);
      dropped++;
    }
  }
  return dropped;
}
