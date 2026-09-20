/**
 * Underline tabs for switching views inside a page.
 * @startingPoint section="Navigation" subtitle="Tabs, stepper, side nav" viewport="700x260"
 */
export interface TabsProps {
  tabs?: Array<string | { value: string; label: string; icon?: string; count?: number }>;
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export function Tabs(props: TabsProps): JSX.Element;
