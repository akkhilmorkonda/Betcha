import React from 'react';
import { interpolate } from 'remotion';
import { c, size, tracking } from '../theme';
import { Reveal } from '../anim/Reveal';
import { Avatar } from './Avatar';
import { OddsBar } from './OddsBar';
import { VerdictChip } from './VerdictChip';

export interface BetCardProps {
  frame: number;
  delay?: number;
  status: 'untaken' | 'live';
  statusChangedAt?: number;
  title: string;
  proposerName: string;
  proposerNote: string;
  actionLabel: string;
  actionMultiplier: string;
  actionPulseAt?: number;
  footer?: React.ReactNode;
}

export function BetCard(props: BetCardProps): React.ReactElement {
  const {
    frame,
    delay = 0,
    status,
    statusChangedAt,
    title,
    proposerName,
    proposerNote,
    actionLabel,
    actionMultiplier,
    actionPulseAt,
    footer,
  } = props;

  const staggerDelay = (index: number) => (delay ?? 0) + index * 3;

  const borderFlashProgress =
    statusChangedAt !== undefined && frame >= statusChangedAt
      ? Math.min(1, (frame - statusChangedAt) / 5)
      : 0;

  const showBorderFlash = borderFlashProgress < 1 && status === 'live';

  return (
    <div
      style={{
        backgroundColor: c.panel,
        border: `1px solid ${showBorderFlash ? c.mint : c.edge}`,
        borderRadius: '16px',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div style={{ padding: '16px' }}>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Reveal
            frame={frame}
            delay={staggerDelay(0)}
            distance={16}
            style={{ position: 'absolute', top: 0, right: 0 }}
          >
            <VerdictChip
              frame={frame}
              delay={0}
              label={status === 'untaken' ? 'UNTAKEN' : 'LIVE'}
              tone={status === 'untaken' ? 'gold' : 'mint'}
              crossfadeFrom={
                statusChangedAt !== undefined && status === 'live'
                  ? {
                      label: 'UNTAKEN',
                      tone: 'gold',
                      at: statusChangedAt,
                    }
                  : undefined
              }
            />
          </Reveal>

          <Reveal
            frame={frame}
            delay={staggerDelay(0)}
            distance={16}
            style={{ paddingRight: '100px' }}
          >
            <div
              style={{
                color: c.cream,
                fontSize: size.sm,
                fontFamily: 'DM Sans',
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              {title}
            </div>
          </Reveal>
        </div>

        <Reveal
          frame={frame}
          delay={staggerDelay(1)}
          distance={16}
          style={{ marginBottom: '12px' }}
        >
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <Avatar name={proposerName} diameter={32} />
            <div
              style={{
                color: c.dim,
                fontSize: size.xs,
                fontFamily: 'DM Sans',
                fontWeight: 400,
              }}
            >
              {proposerName} {proposerNote}
            </div>
          </div>
        </Reveal>

        <Reveal
          frame={frame}
          delay={staggerDelay(2)}
          distance={16}
          style={{ marginBottom: footer ? '12px' : 0 }}
        >
          <OddsBar
            frame={frame}
            delay={0}
            label={actionLabel}
            multiplier={actionMultiplier}
            pulse={status === 'live'}
            pulseAt={actionPulseAt}
          />
        </Reveal>

        {footer && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: `1px solid ${c.edge}`,
              color: c.dim,
              fontSize: size.xs,
              fontFamily: 'DM Sans',
              fontWeight: 400,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
