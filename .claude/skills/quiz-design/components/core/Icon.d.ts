/**
 * Lucide icon rendered via CSS mask so it takes its colour from `color` / currentColor.
 */
export interface IconProps {
  /** Lucide icon slug, e.g. "play", "users", "timer". */
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Any CSS colour. Defaults to currentColor. */
  color?: string;
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
