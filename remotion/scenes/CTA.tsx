import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20, 100, 120], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [0, 30], [0.95, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 10,
          }}
        >
          Start predicting with your friends
        </p>
        <p
          style={{
            fontSize: 18,
            color: '#94a3b8',
            marginBottom: 30,
          }}
        >
          HackMIT 2026
        </p>
        <p
          style={{
            fontSize: 16,
            color: '#64748b',
          }}
        >
          github.com/your-username/betcha
        </p>
      </div>
    </AbsoluteFill>
  );
};
