/** Pill status marker — session state, question type, correctness. */
export interface BadgeProps {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'live';
  /** Lucide icon slug. */
  icon?: string;
  /** Leading 6px dot in the current colour. */
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Badge(props: BadgeProps): JSX.Element;
