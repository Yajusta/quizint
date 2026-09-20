/** Label + hint/error wrapper for any form control. */
export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** When set, replaces the hint and turns it red. */
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Field(props: FieldProps): JSX.Element;
