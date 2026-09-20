import type * as React from 'react';

/** Placeholder for an empty list — quiz library, results with no participants. */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon slug. */
  icon?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Local patch (lot 2): `dark` = stage variant. */
  tone?: 'light' | 'dark';
  style?: React.CSSProperties;
}
export function EmptyState(props: EmptyStateProps): React.JSX.Element;
