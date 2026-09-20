import React from 'react';
import { interpolate } from 'remotion';
import { c, size, tracking } from '../theme';
import { shot } from '../beats';
import { RatingRow } from '../ui/RatingRow';
import { Reveal } from '../anim/Reveal';

const SHOT = shot('S8Reprice');

export function S8Reprice(): React.ReactElement {
  const localFrame = SHOT.durationInFrames - 1;
  const flipStartFrame = 0;

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
        gap: '32px',
        padding: '40px',
      }}
    >
      <RatingRow
        frame={localFrame}
        delay={0}
        label="Akkhil · dares"
        from="1089"
        to="1118"
        tone="mint"
        flipAt={flipStartFrame}
      />
      <RatingRow
        frame={localFrame}
        delay={0}
        label="the cold plunge"
        from="1484"
        to="1469"
        tone="red"
        flipAt={flipStartFrame}
      />
      <OddsChange localFrame={localFrame} flipStartFrame={flipStartFrame} />
    </div>
  );
}

interface OddsChangeProps {
  localFrame: number;
  flipStartFrame: number;
}

function OddsChange(props: OddsChangeProps): React.ReactElement {
  const { localFrame, flipStartFrame } = props;
  const flipDuration = 12;
  const flipProgress = Math.max(0, Math.min(1, (localFrame - flipStartFrame) / flipDuration));

  const oldOpacity = 1 - flipProgress;
  const newOpacity = flipProgress;

  return (
    <Reveal frame={localFrame} delay={0} variant="rise" distance={16}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          justifyContent: 'center',
        }}
      >
        {oldOpacity > 0 && (
          <div
            style={{
              opacity: oldOpacity,
              textDecoration: 'line-through',
              color: c.dim,
              fontSize: size.md,
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: tracking[size.md],
              position: 'absolute',
            }}
          >
            8.47x
          </div>
        )}
        {newOpacity > 0 && (
          <div
            style={{
              opacity: newOpacity,
              color: c.cream,
              fontSize: size.md,
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: tracking[size.md],
            }}
          >
            7.32x
          </div>
        )}
      </div>
    </Reveal>
  );
}
