/** One ranking row. Stack with 8px gaps; set `highlight` on the reader's own row. */
export interface LeaderboardRowProps {
  rank?: number;
  name?: string;
  score?: number;
  /** Places gained/lost since the previous question. */
  delta?: number;
  tone?: 'light' | 'dark';
  highlight?: boolean;
  style?: React.CSSProperties;
}
export function LeaderboardRow(props: LeaderboardRowProps): JSX.Element;
