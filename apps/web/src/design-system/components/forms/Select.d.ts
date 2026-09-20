import type * as React from 'react';

/** Native select with brand chrome. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<string | { value: string; label: string }>;
  error?: boolean;
}
export function Select(props: SelectProps): React.JSX.Element;
