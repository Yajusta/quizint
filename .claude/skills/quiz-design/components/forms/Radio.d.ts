/** Exclusive choice group. */
export interface RadioProps {
  options?: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  direction?: 'column' | 'row';
  style?: React.CSSProperties;
}
export function Radio(props: RadioProps): JSX.Element;
