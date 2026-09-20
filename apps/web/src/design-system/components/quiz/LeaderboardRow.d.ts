import type * as React from 'react';

/** One ranking row. Stack with 8px gaps; set `highlight` on the reader's own row. */
export interface LeaderboardRowProps extends React.HTMLAttributes<HTMLDivElement> {
  rank?: number;
  name?: string;
  /** Local patch (lot 2): a node (e.g. `CountUp`) renders as is; a number is formatted fr-FR. */
  score?: number | React.ReactNode;
  /** Places gained/lost since the previous question. */
  delta?: number;
  tone?: 'light' | 'dark';
  highlight?: boolean;
  style?: React.CSSProperties;
}
export function LeaderboardRow(props: LeaderboardRowProps): React.JSX.Element;
