/**
 * Money is always rendered with a dollar sign so it can never be mistaken for a
 * rating. Cents show only when they exist: $25, $8.50, $99.20.
 *
 * THE BOUNDARY. Everything upstream — the database, market.ts, bets.ts, the API
 * and component state — holds money as a whole number of CENTS. This is the one
 * place it turns into dollars, and it is the only place a division by 100 is
 * correct. Passing dollars in here renders an amount 100x too small.
 */
export function money(cents: number): string {
  const v = Math.round(cents) / 100;
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Explicit + or - in front, for deltas. Takes cents, like money(). */
export function signed(cents: number): string {
  const v = Math.round(cents);
  return `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;
}

/** Odds are NOT money — no dollar sign here, deliberately. */
export const mult = (n: number) => `${n.toFixed(2)}x`;

export function timeLeft(deadline: string | Date): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
  if (h < 24) return h === 1 ? "1h left" : `${h}h left`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day left" : `${d} days left`;
}
