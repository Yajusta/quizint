import type * as React from 'react';

/** Countdown ring with the remaining seconds in mono. */
export interface TimerProps extends React.HTMLAttributes<HTMLDivElement> {
  seconds?: number;
  total?: number;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Local patch: `brand` is the default — `--brand-700` on the light app, `--brand-300` with
   * `inverse` on the stage; both switch to `--state-danger` at 5 seconds or less.
   */
  tone?: 'brand' | 'inverse';
  style?: React.CSSProperties;
}
export function Timer(props: TimerProps): React.JSX.Element;
