/** Question wording block, sized for projection. `tone="dark"` on the presentation stage. */
export interface QuestionDisplayProps {
  index?: number;
  total?: number;
  children?: React.ReactNode;
  /** Optional image/diagram slot below the wording. */
  media?: React.ReactNode;
  tone?: 'light' | 'dark';
  meta?: React.ReactNode;
  style?: React.CSSProperties;
}
export function QuestionDisplay(props: QuestionDisplayProps): JSX.Element;
