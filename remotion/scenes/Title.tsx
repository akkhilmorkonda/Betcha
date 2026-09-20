import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export const Title: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 30, 420, 450], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [60, 90, 390, 420], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoScale = interpolate(frame, [0, 30], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: titleOpacity, transform: `scale(${logoScale})`, transition: 'all 0.3s ease' }}>
        <h1
          style={{
            fontSize: 120,
            fontWeight: 800,
            marginBottom: 20,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textAlign: 'center',
            letterSpacing: -2,
          }}
        >
          BETCHA
        </h1>
      </div>

      <div style={{ opacity: subtitleOpacity, marginTop: 20 }}>
        <p
          style={{
            fontSize: 28,
            color: '#a0aec0',
            textAlign: 'center',
            fontWeight: 400,
            maxWidth: 800,
          }}
        >
          Peer-to-peer prediction markets for friend groups
        </p>
      </div>
    </AbsoluteFill>
  );
};
