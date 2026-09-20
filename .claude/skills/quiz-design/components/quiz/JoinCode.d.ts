/** The session code participants type in. Mono, wide tracking, grouped digits. */
export interface JoinCodeProps {
  code?: string;
  label?: React.ReactNode;
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}
export function JoinCode(props: JoinCodeProps): JSX.Element;
