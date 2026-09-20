import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export const DemoFlow: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30, 270, 300], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const steps = [
    { num: '1', title: 'Create a bet', detail: 'Back it with your fake cash' },
    { num: '2', title: 'Get odds', detail: 'Elo-priced based on history' },
    { num: '3', title: 'Photo or vote', detail: 'Evidence or circle decides' },
    { num: '4', title: 'Settle up', detail: 'Ratings move, odds re-price instantly' },
  ];

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
      <h2
        style={{
          fontSize: 48,
          fontWeight: 700,
          marginBottom: 50,
          color: '#fff',
        }}
      >
        How it plays
      </h2>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          alignItems: 'center',
          maxWidth: 1000,
          flexWrap: 'wrap',
        }}
      >
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div
              style={{
                padding: '30px 25px',
                borderRadius: 12,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '2px solid rgba(59, 130, 246, 0.5)',
                textAlign: 'center',
                minWidth: 180,
                animation: `popIn 0.5s ease-out ${i * 0.1}s backwards`,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: '#3b82f6',
                  marginBottom: 10,
                }}
              >
                {step.num}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                {step.title}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                {step.detail}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ fontSize: 32, color: '#64748b', margin: '0 10px' }}>
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <style>{`
        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </AbsoluteFill>
  );
};
