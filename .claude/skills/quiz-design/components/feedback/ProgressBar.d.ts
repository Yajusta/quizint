/**
 * Horizontal progress / distribution bar.
 * @startingPoint section="Feedback" subtitle="Progress, timer, dialog, empty state" viewport="700x260"
 */
export interface ProgressBarProps {
  value?: number;
  max?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  /** Shows a label row with the percentage. */
  label?: React.ReactNode;
  style?: React.CSSProperties;
}
export function ProgressBar(props: ProgressBarProps): JSX.Element;
