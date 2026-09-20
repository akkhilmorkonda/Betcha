import React from 'react';
import { c, num, size, tracking } from '../theme';
import { Reveal } from '../anim/Reveal';

export interface StatProps {
  frame: number;
  delay?: number;
  label?: string;
  value: string;
  valueColor?: keyof typeof c;
  fontSize?: keyof typeof size;
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

export function Stat(props: StatProps): React.ReactElement {
  const {
    frame,
    delay = 0,
    label,
    value,
    valueColor = 'cream',
    fontSize = 'md',
    align = 'left',
    numeric = false,
  } = props;

  const fontSizeValue = size[fontSize];
  const fontFamily = numeric ? num.fontFamily : 'DM Sans';
  const fontWeight = numeric ? num.fontWeight : 400;
  const fontVariantNumeric = numeric ? num.fontVariantNumeric : 'normal';
  const letterSpacing = tracking[fontSizeValue] ?? 0;

  return (
    <Reveal frame={frame} delay={delay} distance={16}>
      <div style={{ textAlign: align as any }}>
        {label && (
          <div
            style={{
              color: c.muted,
              fontSize: fontSizeValue,
              fontFamily: 'DM Sans',
              fontWeight: 400,
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            {label}
          </div>
        )}
        <div
          style={{
            color: c[valueColor],
            fontSize: fontSizeValue,
            fontFamily,
            fontWeight,
            fontVariantNumeric,
            letterSpacing,
          }}
        >
          {value}
        </div>
      </div>
    </Reveal>
  );
}
