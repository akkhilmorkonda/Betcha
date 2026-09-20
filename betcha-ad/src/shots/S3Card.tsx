import React from 'react';
import { interpolate } from 'remotion';
import { c, size, tracking } from '../theme';
import { shot, atBeat } from '../beats';
import { PhoneFrame } from '../ui/PhoneFrame';
import { BetCard } from '../ui/BetCard';
import { Reveal } from '../anim/Reveal';

const SHOT = shot('S3Card');

export function S3Card(): React.ReactElement {
  const localFrame = SHOT.durationInFrames - 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: c.ink,
        padding: '40px 80px',
        gap: '40px',
        overflow: 'hidden',
      }}
    >
      <PhoneFrame frame={localFrame} delay={0}>
        <div
          style={{
            padding: '16px',
            height: '100%',
            overflow: 'auto',
            backgroundColor: c.ink,
          }}
        >
          <BetCard
            frame={localFrame}
            delay={0}
            status="untaken"
            title="Akkhil cold-plunges for 3 minutes"
            proposerName="Dev"
            proposerNote="says no chance · $60 up · 2 days left"
            actionLabel="Akkhil does it"
            actionMultiplier="10.71x"
          />
        </div>
      </PhoneFrame>

      <StatementLine localFrame={localFrame} />
    </div>
  );
}

interface StatementLineProps {
  localFrame: number;
}

function StatementLine(props: StatementLineProps): React.ReactElement {
  const { localFrame } = props;

  return (
    <Reveal
      frame={localFrame}
      delay={0}
      variant="rise"
      distance={24}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <div
        style={{
          color: c.dim,
          fontSize: size.md,
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          letterSpacing: tracking[size.md],
          lineHeight: 1.35,
          maxWidth: '300px',
        }}
      >
        Someone puts money where their mouth is.
      </div>
    </Reveal>
  );
}
