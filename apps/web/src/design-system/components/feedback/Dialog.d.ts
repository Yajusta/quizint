import type * as React from 'react';

/** Modal over a scrim. Local patch: portalled to `<body>`, `position: fixed`, focus trap, Escape closes. */
export interface DialogProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  width?: number | string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Dialog(props: DialogProps): React.JSX.Element | null;
