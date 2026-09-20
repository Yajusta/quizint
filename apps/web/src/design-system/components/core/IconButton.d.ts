import type * as React from 'react';

/** Square icon-only button. `label` is required — it becomes the accessible name and tooltip. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon slug. */
  icon: string;
  label: string;
  variant?: 'secondary' | 'ghost' | 'primary' | 'inverse';
  /** `xl` = 64px (local patch) — sits next to an `Input size="xl"`. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  /** Local patch (lot 4, contract only): React 19 passes `ref` through `...rest` — drag handle. */
  ref?: React.Ref<HTMLButtonElement>;
}
export function IconButton(props: IconButtonProps): React.JSX.Element;
