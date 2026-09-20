/** Single live metric — participants connectés, taux de réponse, temps moyen. */
export interface StatTileProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  unit?: React.ReactNode;
  /** Lucide icon slug. */
  icon?: string;
  tone?: 'light' | 'dark';
  trend?: React.ReactNode;
  style?: React.CSSProperties;
}
export function StatTile(props: StatTileProps): JSX.Element;
