import type * as React from 'react';

/** Multi-line text input; vertical resize only. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  /** Local patch (lot 4, contract only): React 19 passes `ref` through `...rest` — used for auto-height. */
  ref?: React.Ref<HTMLTextAreaElement>;
}
export function Textarea(props: TextareaProps): React.JSX.Element;
