/** Placeholder for an empty list — quiz library, results with no participants. */
export interface EmptyStateProps {
  /** Lucide icon slug. */
  icon?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export function EmptyState(props: EmptyStateProps): JSX.Element;
