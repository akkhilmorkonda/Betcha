import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export const Solution: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30, 420, 450], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const features = [
    {
      icon: '⚡',
      title: 'Elo-Priced Odds',
      desc: 'Your history determines your odds. The market never moves—your ratings do.',
    },
    {
      icon: '📸',
      title: 'Photo Evidence',
      desc: 'Settle bets with real photos. AI judges clearly, circle votes on edge cases.',
    },
    {
      icon: '💰',
      title: 'Fake Currency',
      desc: 'Start with $120. No real money. Settle up however you like after.',
    },
    {
      icon: '📊',
      title: 'Skill Ratings',
      desc: 'See who is sharp at calling bets. Forecasting is a separate skill from execution.',
    },
  ];

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        padding: '0 40px',
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 700,
          marginBottom: 60,
          textAlign: 'center',
          color: '#fff',
        }}
      >
        Betcha solves it
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 1100 }}>
        {features.map((feature, i) => (
          <div
            key={i}
            style={{
              padding: '30px',
              borderRadius: 16,
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              animation: `slideIn 0.6s ease-out ${i * 0.15}s backwards`,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 15 }}>{feature.icon}</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: '#fff' }}>
              {feature.title}
            </h3>
            <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 }}>
              {feature.desc}
            </p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </AbsoluteFill>
  );
};
