/**
 * Money is always rendered with a dollar sign so it can never be mistaken for a
 * rating. Cents show only when they exist: $25, $8.50, $99.20.
 */
export function money(n: number): string {
  const v = Math.round(n * 100) / 100;
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Explicit + or − in front, for deltas. */
export function signed(n: number): string {
  const v = Math.round(n * 100) / 100;
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
