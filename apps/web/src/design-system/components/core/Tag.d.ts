import type * as React from 'react';

/** Editable/selectable keyword chip — quiz themes, filters. Compare Badge, which is read-only. */
export interface TagProps {
  children?: React.ReactNode;
  /** Shows a remove affordance. */
  onRemove?: (e: React.MouseEvent) => void;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export function Tag(props: TagProps): React.JSX.Element;
