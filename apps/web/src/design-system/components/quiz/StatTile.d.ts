import type * as React from 'react';

/** Single live metric — participants connectés, taux de réponse, temps moyen. */
export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value?: React.ReactNode;
  unit?: React.ReactNode;
  /** Lucide icon slug. */
  icon?: string;
  tone?: 'light' | 'dark';
  trend?: React.ReactNode;
  style?: React.CSSProperties;
}
export function StatTile(props: StatTileProps): React.JSX.Element;
