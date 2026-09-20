import React from 'react';
import { interpolate } from 'remotion';
import { c, num, size } from '../theme';
import { Reveal } from '../anim/Reveal';

export interface OddsBarProps {
  frame: number;
  delay?: number;
  label: string;
  multiplier: string;
  pulse?: boolean;
  pulseAt?: number;
}

export function OddsBar(props: OddsBarProps): React.ReactElement {
  const { frame, delay = 0, label, multiplier, pulse = false, pulseAt } = props;

  const pulseOpacity =
    pulse && pulseAt !== undefined && frame >= pulseAt
      ? interpolate(frame - pulseAt, [0, 20], [0.5, 0], {
          extrapolateRight: 'clamp',
        })
      : 0;

  const pulseScale =
    pulse && pulseAt !== undefined && frame >= pulseAt
      ? interpolate(frame - pulseAt, [0, 20], [1, 1.15], {
          extrapolateRight: 'clamp',
        })
      : 1;

  return (
    <Reveal frame={frame} delay={delay} variant="rise">
      <div
        style={{
          position: 'relative',
          width: '100%',
        }}
      >
        {pulse && (
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '8px',
              border: `2px solid ${c.mint}`,
              opacity: pulseOpacity,
              transform: `scale(${pulseScale})`,
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            backgroundColor: c.mint,
            color: c.ink,
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '12px',
            paddingBottom: '12px',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: size.sm,
            fontFamily: 'DM Sans',
            fontWeight: 500,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <span>{label}</span>
          <span
            style={{
              fontFamily: num.fontFamily,
              fontWeight: num.fontWeight,
              fontVariantNumeric: num.fontVariantNumeric,
            }}
          >
            {multiplier}
          </span>
        </div>
      </div>
    </Reveal>
  );
}
