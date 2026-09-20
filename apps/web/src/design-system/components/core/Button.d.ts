import type * as React from 'react';

/**
 * Primary action control.
 * @startingPoint section="Core" subtitle="Buttons, icon buttons, badges and tags" viewport="700x220"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
  /** `xl` = 64px — participant thumb targets and stage actions (local patch). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Lucide icon slug or a node, placed before the label. */
  icon?: string | React.ReactNode;
  iconRight?: string | React.ReactNode;
  /** Full-width. */
  block?: boolean;
  /** Local patch: swaps the leading icon for a spinner, sets `aria-busy` and blocks clicks. */
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): React.JSX.Element;
