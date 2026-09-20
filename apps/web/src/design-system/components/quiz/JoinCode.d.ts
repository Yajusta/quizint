import type * as React from 'react';

/** The session code participants type in. Mono, wide tracking, grouped digits. */
export interface JoinCodeProps extends React.HTMLAttributes<HTMLDivElement> {
  code?: string;
  label?: React.ReactNode;
  /** Local patch (lot 2): `brand` = --brand-700 on a light panel (stage QR panel). */
  tone?: 'dark' | 'light' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}
export function JoinCode(props: JoinCodeProps): React.JSX.Element;
