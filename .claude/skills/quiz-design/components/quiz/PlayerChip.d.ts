/** A participant in the lobby grid: tinted initials avatar + pseudonym. */
export interface PlayerChipProps {
  name?: string;
  tone?: 'light' | 'dark';
  /** Index used to pick the avatar tint from the answer-channel palette. */
  seed?: number;
  style?: React.CSSProperties;
}
export function PlayerChip(props: PlayerChipProps): JSX.Element;
