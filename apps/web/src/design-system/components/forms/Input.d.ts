import type * as React from 'react';

/**
 * Single-line text input.
 * @startingPoint section="Forms" subtitle="Inputs, select, checkbox, switch, radio" viewport="700x300"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Lucide icon slug shown inside, left. */
  icon?: string;
  error?: boolean;
  /** `xl` = 64px — participant code entry and numeric answer (local patch). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
export function Input(props: InputProps): React.JSX.Element;
