import React from 'react';
import { AbsoluteFill } from 'remotion';
import { c, size, springs } from '../theme';
import { useCount } from '../anim/useCount';
import { Reveal } from '../anim/Reveal';

export function S7Payout(): React.ReactElement {
  const localFrame = 41; // full shot duration

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: c.ink,
        gap: '24px',
      }}
    >
      <PayoutRow
        label="you"
        value={useCount({ frame: localFrame, from: 0, to: 6000, durationInFrames: 20, delay: 0 })}
        color={c.mint}
        sign="+"
        localFrame={localFrame}
      />
      <PayoutRow
        label="Dev"
        value={useCount({ frame: localFrame, from: 0, to: 6000, durationInFrames: 20, delay: 0 })}
        color={c.red}
        sign="−"
        localFrame={localFrame}
      />
      <div
        style={{
          color: c.muted,
          fontSize: size.xs,
          fontFamily: 'DM Sans',
          fontWeight: 400,
          marginTop: '16px',
        }}
      >
        exactly what he put up. never a cent more.
      </div>
    </div>
  );
}

interface PayoutRowProps {
  label: string;
  value: number;
  color: string;
  sign: string;
  localFrame: number;
}

function PayoutRow(props: PayoutRowProps): React.ReactElement {
  const { label, value, color, sign, localFrame } = props;
  const formattedValue = (value / 100).toFixed(2);

  return (
    <Reveal frame={localFrame} delay={0} variant="rise" distance={16}>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'baseline',
        }}
      >
        <div
          style={{
            color: c.dim,
            fontSize: size.md,
            fontFamily: 'DM Sans',
            fontWeight: 400,
            minWidth: '60px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            color,
            fontSize: size.md,
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {sign}${formattedValue}
        </div>
      </div>
    </Reveal>
  );
}
