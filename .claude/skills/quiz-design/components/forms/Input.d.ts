/**
 * Single-line text input.
 * @startingPoint section="Forms" subtitle="Inputs, select, checkbox, switch, radio" viewport="700x300"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Lucide icon slug shown inside, left. */
  icon?: string;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
export function Input(props: InputProps): JSX.Element;
