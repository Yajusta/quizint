/**
 * One answer choice. Options are never colour-coded: the letter tile is neutral and colour appears
 * only as state — brand for the participant's selection, green/red once the answer is revealed.
 * @startingPoint section="Quiz" subtitle="Answer options, question display, join code, leaderboard" viewport="700x340"
 */
export interface AnswerOptionProps {
  letter?: 'A' | 'B' | 'C' | 'D' | string;
  children?: React.ReactNode;
  /**
   * Question phase: `default` (proposition) | `selected`.
   * Answer phase: `correct` | `wrong` | `muted` (not chosen / not the answer).
   */
  state?: 'default' | 'selected' | 'correct' | 'wrong' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  /** 0–100; share of participants who picked it, shown after the reveal. */
  distribution?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function AnswerOption(props: AnswerOptionProps): JSX.Element;
