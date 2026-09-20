/** Linear progress through a short flow (créer → questions → lancer). */
export interface StepperProps {
  steps?: string[];
  /** Zero-based index of the active step. */
  current?: number;
  style?: React.CSSProperties;
}
export function Stepper(props: StepperProps): JSX.Element;
