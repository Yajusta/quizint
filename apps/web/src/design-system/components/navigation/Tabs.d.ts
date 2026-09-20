import type * as React from 'react';

/**
 * Underline tabs for switching views inside a page.
 * @startingPoint section="Navigation" subtitle="Tabs, stepper, side nav" viewport="700x260"
 */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs?: Array<string | { value: string; label: string; icon?: string; count?: number }>;
  value?: string;
  onChange?: (value: string) => void;
  /** Local patch: tabs fill the container's height — for a top bar. */
  fill?: boolean;
  /** Local patch (lot 4): the whole group is inert; the active tab stays underlined in gray. */
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Tabs(props: TabsProps): React.JSX.Element;
