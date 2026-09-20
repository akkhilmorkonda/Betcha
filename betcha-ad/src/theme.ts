/** The only place a colour literal may appear. Grep src/shots for '#'. */
export const c = {
  ink: '#0B0D12',
  panel: '#14171F',
  edge: '#242938',
  cream: '#F8F4EF',
  dim: '#A8B0C0',
  muted: '#7E8798',
  mint: '#6AF899',
  red: '#E2565C',
  gold: '#F0B429',
} as const;

/** The only sizes in the film. No others. */
export const size = {
  display: 120,
  xl: 72,
  lg: 56,
  md: 44,
  sm: 32,
  xs: 28,
} as const;

export const tracking: Record<number, number> = {
  120: -3,
  72: -2,
  56: -1,
  44: 0,
  32: 0,
  28: 0,
};

export const num = {
  fontFamily: 'Space Grotesk',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
} as const;

export const springs = {
  /** Entrances. Settles clean, no overshoot. */
  enter: { damping: 200, mass: 0.6, stiffness: 120 },
  /** Where a small overshoot is wanted. */
  pop: { damping: 30, mass: 0.4 },
} as const;
