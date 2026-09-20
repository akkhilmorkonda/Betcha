import { interpolate, Easing } from 'remotion';

export interface UseCountOptions {
  frame: number;
  from: number;
  to: number;
  durationInFrames: number;
  delay?: number;
}

export function useCount(options: UseCountOptions): number {
  const { frame, from, to, durationInFrames, delay = 0 } = options;
  return interpolate(frame - delay, [0, durationInFrames], [from, to], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
