/** Stable tint per member so the same face colour follows them everywhere. */
const TINTS = ["#2B3243", "#38304A", "#2A3B38", "#3A2E2E", "#2F3348", "#333A2C"];

export function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export const initial = (name: string) => name.slice(0, 1).toUpperCase();
