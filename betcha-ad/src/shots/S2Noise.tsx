import React from 'react';
import { interpolate } from 'remotion';
import { c, size, tracking } from '../theme';
import { shot, atBar } from '../beats';
import { Reveal } from '../anim/Reveal';

const SHOT = shot('S2Noise');

const QUOTES = [
  "I'll beat you at tennis.",
  "No way you get a higher grade.",
  "Betcha can't do it.",
];

export function S2Noise(): React.ReactElement {
  const localFrame = SHOT.durationInFrames - 1;
  const exitStartFrame = atBar(3.5) - SHOT.from;

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
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {QUOTES.map((quote, index) => (
        <QuoteLine
          key={index}
          quote={quote}
          index={index}
          localFrame={localFrame}
          exitStartFrame={exitStartFrame}
        />
      ))}

      <NewStatementLine localFrame={localFrame} exitStartFrame={exitStartFrame} />
    </div>
  );
}

interface QuoteLineProps {
  quote: string;
  index: number;
  localFrame: number;
  exitStartFrame: number;
}

function QuoteLine(props: QuoteLineProps): React.ReactElement {
  const { quote, index, localFrame, exitStartFrame } = props;
  const delay = index * 6;

  const hasExited = localFrame >= exitStartFrame;
  const exitProgress = hasExited
    ? Math.min(1, (localFrame - exitStartFrame) / 20)
    : 0;

  const opacity = hasExited
    ? interpolate(exitProgress, [0, 1], [1, 0.4])
    : 1;
  const translateX = hasExited
    ? interpolate(exitProgress, [0, 1], [0, -40])
    : 0;
  const blur = hasExited
    ? interpolate(exitProgress, [0, 1], [0, 6])
    : 0;
  const displayColor = hasExited && exitProgress > 0.5 ? c.muted : c.cream;

  const xOffset = (index - 1) * 60;

  return (
    <Reveal
      frame={localFrame}
      delay={delay}
      variant="pop"
      distance={24}
      style={{
        transform: `translateX(${xOffset + translateX}px)`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        position: 'absolute',
        top: `${140 + index * 80}px`,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          color: displayColor,
          fontSize: size.xl,
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          letterSpacing: tracking[size.xl],
        }}
      >
        "{quote}"
      </div>
    </Reveal>
  );
}

interface NewStatementLineProps {
  localFrame: number;
  exitStartFrame: number;
}

function NewStatementLine(props: NewStatementLineProps): React.ReactElement {
  const { localFrame, exitStartFrame } = props;

  const hasStarted = localFrame >= exitStartFrame;
  const startProgress = hasStarted
    ? Math.min(1, (localFrame - exitStartFrame) / 8)
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        opacity: startProgress,
      }}
    >
      <div
        style={{
          color: c.mint,
          fontSize: size.xl,
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          letterSpacing: tracking[size.xl],
          textAlign: 'center',
        }}
      >
        Nothing is ever on the line.
      </div>
    </div>
  );
}
