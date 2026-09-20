import React from 'react';
import { interpolate } from 'remotion';
import { c, size } from '../theme';
import { Reveal } from '../anim/Reveal';

export interface VerdictChipProps {
  label: string;
  tone: 'gold' | 'mint';
  frame: number;
  delay?: number;
  crossfadeFrom?: {
    label: string;
    tone: 'gold' | 'mint';
    at: number;
  };
}

export function VerdictChip(props: VerdictChipProps): React.ReactElement {
  const { label, tone, frame, delay = 0, crossfadeFrom } = props;

  let displayLabel = label;
  let displayTone = tone;
  let crossfadeProgress = 0;

  if (crossfadeFrom && frame >= crossfadeFrom.at) {
    crossfadeProgress = Math.min(1, (frame - crossfadeFrom.at) / 7);
  }

  const oldOpacity = 1 - crossfadeProgress;
  const newOpacity = crossfadeProgress;

  return (
    <Reveal frame={frame} delay={delay} variant="pop">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {crossfadeFrom && oldOpacity > 0 && (
          <ChipLabel
            label={crossfadeFrom.label}
            tone={crossfadeFrom.tone}
            opacity={oldOpacity}
          />
        )}
        <ChipLabel label={label} tone={tone} opacity={newOpacity} />
      </div>
    </Reveal>
  );
}

interface ChipLabelProps {
  label: string;
  tone: 'gold' | 'mint';
  opacity: number;
}

function ChipLabel(props: ChipLabelProps): React.ReactElement {
  const { label, tone, opacity } = props;
  const bgColor = c[tone];

  return (
    <span
      style={{
        display: 'inline-block',
        opacity,
        backgroundColor: bgColor,
        color: c.ink,
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '6px',
        paddingBottom: '6px',
        borderRadius: '12px',
        fontSize: size.xs,
        fontFamily: 'DM Sans',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '2px',
      }}
    >
      {label}
    </span>
  );
}
