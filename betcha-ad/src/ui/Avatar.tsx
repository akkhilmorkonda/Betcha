import React from 'react';
import { c, size } from '../theme';

export interface AvatarProps {
  name: string;
  diameter?: number;
}

export function Avatar(props: AvatarProps): React.ReactElement {
  const { name, diameter = 40 } = props;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        backgroundColor: c.panel,
        border: `1px solid ${c.edge}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: c.cream,
          fontSize: size.xs,
          fontFamily: 'DM Sans',
          fontWeight: 700,
        }}
      >
        {initial}
      </span>
    </div>
  );
}
