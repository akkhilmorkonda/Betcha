import React from 'react';
import { interpolate, spring, staticFile, useVideoConfig } from 'remotion';
import { c, size, springs } from '../theme';
import { shot, atBeat, atBar } from '../beats';
import { Reveal } from '../anim/Reveal';

const SHOT = shot('S1Open');

export function S1Open(): React.ReactElement {
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
      }}
    >
      <LogoStack />
      <SubheadText />
    </div>
  );
}

function LogoStack(): React.ReactElement {
  const { fps } = useVideoConfig();
  const localFrame = SHOT.durationInFrames - 1;

  const markProgress = spring({
    frame: Math.min(localFrame, 20),
    fps,
    config: springs.enter,
  });

  const markScale = interpolate(markProgress, [0, 1], [0.86, 1]);

  const crownOpacity = interpolate(
    Math.min(localFrame, 23),
    [0, 20, 23],
    [0, 0, 1]
  );

  const wordmarkClipProgress = interpolate(Math.min(localFrame, atBeat(4)), [0, atBeat(4)], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const wordmarkOpacity = interpolate(Math.min(localFrame, atBeat(4)), [0, atBeat(4)], [0, 1], {
    extrapolateRight: 'clamp',
    easing: require('remotion').Easing.out(require('remotion').Easing.cubic),
  });

  const globalExitFrame = Math.max(0, localFrame - atBar(2));
  const exitOpacity = interpolate(globalExitFrame, [0, 6], [1, 0], {
    extrapolateRight: 'clamp',
  });
  const exitScale = interpolate(globalExitFrame, [0, 6], [1, 0.98], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
        position: 'relative',
        width: '300px',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          opacity: 1,
          transform: `scale(${markScale})`,
        }}
      >
        <img
          src={staticFile('logo-mark.png')}
          alt="mark"
          style={{
            width: '120px',
            height: '120px',
            display: 'block',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          opacity: wordmarkOpacity,
          left: '50%',
          transform: `translateX(-${wordmarkClipProgress * 100}%)`,
          overflow: 'hidden',
        }}
      >
        <img
          src={staticFile('logo-transparent.png')}
          alt="wordmark"
          style={{
            width: '300px',
            height: '120px',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

function SubheadText(): React.ReactElement {
  const textStart = atBeat(6);
  const localFrame = SHOT.durationInFrames - 1;
  const textFrame = Math.max(0, localFrame - textStart);

  const textOpacity = interpolate(textFrame, [0, 8], [0, 1], {
    easing: require('remotion').Easing.out(require('remotion').Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const globalExitFrame = Math.max(0, localFrame - atBar(2));
  const exitOpacity = interpolate(globalExitFrame, [0, 6], [1, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        textAlign: 'center',
        opacity: textOpacity * exitOpacity,
        maxWidth: '500px',
      }}
    >
      <div
        style={{
          color: c.muted,
          fontSize: size.xs,
          fontFamily: 'DM Sans',
          fontWeight: 400,
          lineHeight: 1.35,
        }}
      >
        a prediction market for your group chat
      </div>
    </div>
  );
}
