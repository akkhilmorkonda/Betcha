import React from 'react';
import { interpolate, spring, useVideoConfig, Easing } from 'remotion';
import { springs } from '../theme';

export type RevealVariant = 'rise' | 'pop' | 'scale';

export interface RevealExit {
  at: number;
  mode: 'fadeScale' | 'fadeBlur';
  durationInFrames?: number;
}

export interface RevealProps {
  children: React.ReactNode;
  frame: number;
  delay?: number;
  variant?: RevealVariant;
  distance?: number;
  blur?: boolean;
  exit?: RevealExit;
  style?: React.CSSProperties;
}

export function Reveal(props: RevealProps): React.ReactElement {
  const {
    children,
    frame,
    delay = 0,
    variant = 'rise',
    distance = 24,
    blur = false,
    exit,
    style,
  } = props;

  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: variant === 'pop' ? springs.pop : springs.enter,
  });

  const opacityFrame = frame - delay;
  const opacity = interpolate(opacityFrame, [0, 8], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let transform = '';
  if (variant === 'rise' || variant === 'pop') {
    const translateY = interpolate(progress, [0, 1], [distance, 0]);
    transform = `translateY(${translateY}px)`;
  } else if (variant === 'scale') {
    const scale = interpolate(progress, [0, 1], [0.94, 1]);
    transform = `scale(${scale})`;
  }

  let filter = '';
  if (blur) {
    const blurAmount = interpolate(opacityFrame, [0, 8], [6, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    filter = `blur(${blurAmount}px)`;
  }

  let finalOpacity = opacity;
  if (exit && frame >= exit.at) {
    const exitDuration = exit.durationInFrames ?? 6;
    const exitProgress = Math.min(1, (frame - exit.at) / exitDuration);
    if (exit.mode === 'fadeScale') {
      finalOpacity = interpolate(exitProgress, [0, 1], [opacity, 0], {
        extrapolateRight: 'clamp',
      });
      const exitScale = interpolate(exitProgress, [0, 1], [1, 0.98], {
        extrapolateRight: 'clamp',
      });
      transform = `${transform} scale(${exitScale})`;
    } else if (exit.mode === 'fadeBlur') {
      finalOpacity = interpolate(exitProgress, [0, 1], [opacity, 0], {
        extrapolateRight: 'clamp',
      });
      const exitBlur = interpolate(exitProgress, [0, 1], [0, 6], {
        extrapolateRight: 'clamp',
      });
      filter = `blur(${exitBlur}px)`;
    }
  }

  return (
    <div
      style={{
        opacity: finalOpacity,
        transform,
        filter,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface TypewriterProps {
  text: string;
  frame: number;
  delay?: number;
  framesPerChar: number;
  style?: React.CSSProperties;
}

export function Typewriter(props: TypewriterProps): React.ReactElement {
  const { text, frame, delay = 0, framesPerChar, style } = props;
  const visibleChars = Math.max(
    0,
    Math.min(text.length, Math.floor((frame - delay) / framesPerChar))
  );
  return <span style={style}>{text.slice(0, visibleChars)}</span>;
}
