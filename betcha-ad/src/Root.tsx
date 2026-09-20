import React from 'react';
import { Composition } from 'remotion';
import { Ad } from './Ad';
import { DURATION_IN_FRAMES, FPS } from './beats';
import './fonts';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BetchaAd"
      component={Ad}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
