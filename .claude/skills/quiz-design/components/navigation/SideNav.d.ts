/** Presenter-app left navigation. */
export interface SideNavProps {
  items?: Array<{ value: string; label: string; icon: string; count?: number }>;
  value?: string;
  onChange?: (value: string) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  style?: React.CSSProperties;
}
export function SideNav(props: SideNavProps): JSX.Element;
