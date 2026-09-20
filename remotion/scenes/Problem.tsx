import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30, 270, 300], [0, 1, 1, 0], {
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
      }}
    >
      <div style={{ maxWidth: 900, textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 56,
            fontWeight: 700,
            marginBottom: 40,
            color: '#fff',
          }}
        >
          Your friend group lives on predictions
        </h2>

        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', marginTop: 40 }}>
          {[
            '🎲 "Who gets the A?"',
            '💪 "Who finishes the dare?"',
            '🏃 "Who runs the fastest?"',
          ].map((text, i) => (
            <div
              key={i}
              style={{
                fontSize: 20,
                color: '#cbd5e1',
                padding: '20px 30px',
                borderRadius: 12,
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                animation: `fadeInUp 0.6s ease-out ${0.2 + i * 0.15}s backwards`,
              }}
            >
              {text}
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 24,
            color: '#94a3b8',
            marginTop: 60,
            fontWeight: 500,
          }}
        >
          But how do you keep them fair? Who wins when it matters?
        </p>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </AbsoluteFill>
  );
};
