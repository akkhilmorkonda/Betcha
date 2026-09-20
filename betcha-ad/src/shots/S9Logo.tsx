import React from 'react';
import { interpolate, staticFile } from 'remotion';
import { c, size, tracking } from '../theme';
import { shot, atBar, AUDIO_FADE_FROM, DURATION_IN_FRAMES } from '../beats';
import { Reveal } from '../anim/Reveal';

const SHOT = shot('S9Logo');

export function S9Logo(): React.ReactElement {
  const localFrame = SHOT.durationInFrames - 1;

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
      }}
    >
      <Reveal frame={localFrame} delay={0} variant="rise" distance={24}>
        <img
          src={staticFile('logo-transparent.png')}
          alt="Betcha"
          style={{ width: '280px', height: '100px', display: 'block' }}
        />
      </Reveal>

      <TaglineWithUnderline localFrame={localFrame} />
    </div>
  );
}

interface TaglineWithUnderlineProps {
  localFrame: number;
}

function TaglineWithUnderline(props: TaglineWithUnderlineProps): React.ReactElement {
  const { localFrame } = props;

  const underlineDrawStart = 8;
  const underlineDrawDuration = 8;
  const underlineProgress = Math.max(
    0,
    Math.min(1, (localFrame - underlineDrawStart) / underlineDrawDuration)
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <Reveal frame={localFrame} delay={0} variant="rise" distance={16}>
        <div
          style={{
            color: c.cream,
            fontSize: size.display,
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            letterSpacing: tracking[size.display],
          }}
        >
          Betcha can't.
        </div>
      </Reveal>

      <svg width="200" height="12" style={{ overflow: 'visible' }}>
        <line
          x1="0"
          y1="6"
          x2={200 * underlineProgress}
          y2="6"
          stroke={c.mint}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
