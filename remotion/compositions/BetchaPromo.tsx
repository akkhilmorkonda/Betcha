import React from 'react';
import { Sequence, useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { Title } from '../scenes/Title';
import { Problem } from '../scenes/Problem';
import { Solution } from '../scenes/Solution';
import { DemoFlow } from '../scenes/DemoFlow';
import { CTA } from '../scenes/CTA';

export const BetchaPromo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f0f' }}>
      {/* Scene 1: Title (0-450 frames = 0-15 seconds at 30fps) */}
      <Sequence from={0} durationInFrames={450}>
        <Title />
      </Sequence>

      {/* Scene 2: Problem (450-750 frames = 10 seconds) */}
      <Sequence from={450} durationInFrames={300}>
        <Problem />
      </Sequence>

      {/* Scene 3: Solution (750-1200 frames = 15 seconds) */}
      <Sequence from={750} durationInFrames={450}>
        <Solution />
      </Sequence>

      {/* Scene 4: Demo (1200-1500 frames = 10 seconds) */}
      <Sequence from={1200} durationInFrames={300}>
        <DemoFlow />
      </Sequence>

      {/* Scene 5: CTA (1500-1620 frames = 4 seconds) */}
      <Sequence from={1500} durationInFrames={120}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
