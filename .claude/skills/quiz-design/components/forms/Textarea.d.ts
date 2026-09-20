/** Multi-line text input; vertical resize only. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}
export function Textarea(props: TextareaProps): JSX.Element;
