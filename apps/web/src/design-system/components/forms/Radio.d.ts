import type * as React from 'react';

/** Exclusive choice group. */
export interface RadioProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Local patch (lot 4): `ariaLabel` names an option whose visible `label` is empty. */
  options?: Array<string | { value: string; label: string; ariaLabel?: string }>;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  direction?: 'column' | 'row';
  /** Local patch (lot 4): the whole group is inert. */
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Radio(props: RadioProps): React.JSX.Element;
