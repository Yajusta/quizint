import type * as React from 'react';

/** Surface container: white, 1px subtle border, 14px radius, shadow-1 at rest. */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | string | number;
  /** Adds hover elevation + pointer cursor. */
  interactive?: boolean;
  /** Brand border + soft ring. */
  selected?: boolean;
  elevation?: 0 | 1;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Card(props: CardProps): React.JSX.Element;
