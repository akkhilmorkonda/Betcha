import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { c } from './theme';
import { SHOTS } from './beats';
import { S1Open } from './shots/S1Open';
import { S2Noise } from './shots/S2Noise';
import { S3Card } from './shots/S3Card';
import { S4Price } from './shots/S4Price';
import { S5Take } from './shots/S5Take';
import { S6Proof } from './shots/S6Proof';
import { S7Payout } from './shots/S7Payout';
import { S8Reprice } from './shots/S8Reprice';
import { S9Logo } from './shots/S9Logo';

/**
 * The timeline, and nothing else. One <Sequence> per shot, every `from` and
 * `durationInFrames` from shot() in beats.ts. No logic lives here.
 */
export const Ad: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={SHOTS.S1Open.from} durationInFrames={SHOTS.S1Open.to - SHOTS.S1Open.from}>
        <S1Open />
      </Sequence>

      <Sequence from={SHOTS.S2Noise.from} durationInFrames={SHOTS.S2Noise.to - SHOTS.S2Noise.from}>
        <S2Noise />
      </Sequence>

      <Sequence from={SHOTS.S3Card.from} durationInFrames={SHOTS.S3Card.to - SHOTS.S3Card.from}>
        <S3Card />
      </Sequence>

      <Sequence from={SHOTS.S4Price.from} durationInFrames={SHOTS.S4Price.to - SHOTS.S4Price.from}>
        <S4Price />
      </Sequence>

      <Sequence from={SHOTS.S5Take.from} durationInFrames={SHOTS.S5Take.to - SHOTS.S5Take.from}>
        <S5Take />
      </Sequence>

      <Sequence from={SHOTS.S6Proof.from} durationInFrames={SHOTS.S6Proof.to - SHOTS.S6Proof.from}>
        <S6Proof />
      </Sequence>

      <Sequence from={SHOTS.S7Payout.from} durationInFrames={SHOTS.S7Payout.to - SHOTS.S7Payout.from}>
        <S7Payout />
      </Sequence>

      <Sequence from={SHOTS.S8Reprice.from} durationInFrames={SHOTS.S8Reprice.to - SHOTS.S8Reprice.from}>
        <S8Reprice />
      </Sequence>

      <Sequence from={SHOTS.S9Logo.from} durationInFrames={SHOTS.S9Logo.to - SHOTS.S9Logo.from}>
        <S9Logo />
      </Sequence>
    </AbsoluteFill>
  );
};
