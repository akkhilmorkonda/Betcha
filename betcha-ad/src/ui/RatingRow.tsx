import React from 'react';
import { interpolate } from 'remotion';
import { c, num, size, tracking } from '../theme';

export interface RatingRowProps {
  frame: number;
  delay?: number;
  label: string;
  from: string;
  to: string;
  tone: 'mint' | 'red';
  flipAt: number;
  flipDurationInFrames?: number;
}

export function RatingRow(props: RatingRowProps): React.ReactElement {
  const {
    frame,
    delay = 0,
    label,
    from,
    to,
    tone,
    flipAt,
    flipDurationInFrames = 11,
  } = props;

  const flipProgress = Math.max(
    0,
    Math.min(1, (frame - flipAt) / flipDurationInFrames)
  );

  const oldTranslateY = interpolate(flipProgress, [0, 1], [0, -16], {
    extrapolateRight: 'clamp',
  });
  const oldOpacity = interpolate(flipProgress, [0, 1], [1, 0], {
    extrapolateRight: 'clamp',
  });

  const newTranslateY = interpolate(flipProgress, [0, 1], [16, 0], {
    extrapolateRight: 'clamp',
  });
  const newOpacity = interpolate(flipProgress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const fontSizeValue = size.md;
  const letterSpacing = tracking[fontSizeValue] ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          color: c.dim,
          fontSize: size.xs,
          fontFamily: 'DM Sans',
          fontWeight: 400,
        }}
      >
        {label}
      </div>

      <div style={{ position: 'relative', minWidth: '120px' }}>
        {flipProgress < 1 && (
          <div
            style={{
              position: 'absolute',
              opacity: oldOpacity,
              transform: `translateY(${oldTranslateY}px)`,
              color: c.dim,
              fontSize: fontSizeValue,
              fontFamily: num.fontFamily,
              fontWeight: num.fontWeight,
              fontVariantNumeric: num.fontVariantNumeric,
              letterSpacing,
              whiteSpace: 'nowrap',
            }}
          >
            {from}
          </div>
        )}

        {flipProgress > 0 && (
          <div
            style={{
              opacity: newOpacity,
              transform: `translateY(${newTranslateY}px)`,
              color: c[tone],
              fontSize: fontSizeValue,
              fontFamily: num.fontFamily,
              fontWeight: num.fontWeight,
              fontVariantNumeric: num.fontVariantNumeric,
              letterSpacing,
              whiteSpace: 'nowrap',
            }}
          >
            {to}
          </div>
        )}
      </div>
    </div>
  );
}
