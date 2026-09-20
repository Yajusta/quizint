/** Square icon-only button. `label` is required — it becomes the accessible name and tooltip. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon slug. */
  icon: string;
  label: string;
  variant?: 'secondary' | 'ghost' | 'primary' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}
export function IconButton(props: IconButtonProps): JSX.Element;
