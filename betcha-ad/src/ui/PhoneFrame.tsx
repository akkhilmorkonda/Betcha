import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { c, springs } from '../theme';

export interface PhoneFrameProps {
  children: React.ReactNode;
  frame: number;
  delay?: number;
  x?: number;
  scale?: number;
  rotateY?: number;
  blur?: boolean;
}

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const PHONE_BORDER_RADIUS = 48;
const PHONE_BORDER_WIDTH = 1;

export function PhoneFrame(props: PhoneFrameProps): React.ReactElement {
  const {
    children,
    frame,
    delay = 0,
    x,
    scale = 1,
    rotateY: explicitRotateY,
    blur = false,
  } = props;

  const { fps } = useVideoConfig();

  let translateY = 0;
  let rotateY = explicitRotateY ?? 0;
  let computedBlur = 0;

  if (explicitRotateY === undefined) {
    const progress = spring({
      frame: frame - delay,
      fps,
      config: springs.enter,
    });

    const maxTranslateY = 80;
    translateY = interpolate(progress, [0, 1], [maxTranslateY, 0]);

    const maxRotateY = 8;
    rotateY = interpolate(progress, [0, 1], [maxRotateY, 0]);

    if (blur) {
      const blurFrame = frame - delay;
      computedBlur = interpolate(blurFrame, [0, 8], [6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  const transform = [
    x !== undefined ? `translateX(${x}px)` : '',
    `translateY(${translateY}px)`,
    `scale(${scale})`,
    `perspective(1200px) rotateY(${rotateY}deg)`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      style={{
        width: PHONE_WIDTH,
        height: PHONE_HEIGHT,
        backgroundColor: c.panel,
        border: `${PHONE_BORDER_WIDTH}px solid ${c.edge}`,
        borderRadius: PHONE_BORDER_RADIUS,
        overflow: 'hidden',
        boxShadow: `inset 0 0 40px ${c.ink}66`,
        transform,
        filter: computedBlur > 0 ? `blur(${computedBlur}px)` : undefined,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  );
}
