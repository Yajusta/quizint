/** Countdown ring with the remaining seconds in mono. */
export interface TimerProps {
  seconds?: number;
  total?: number;
  size?: 'sm' | 'md' | 'lg';
  /** auto = green → amber → red as time runs out. */
  tone?: 'auto' | 'brand' | 'inverse';
  style?: React.CSSProperties;
}
export function Timer(props: TimerProps): JSX.Element;
