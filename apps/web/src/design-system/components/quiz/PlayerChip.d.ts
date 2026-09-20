import type * as React from 'react';

/** A participant in the lobby grid: tinted initials avatar + pseudonym. */
export interface PlayerChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  tone?: 'light' | 'dark';
  /** Index used to pick the avatar tint from the answer-channel palette. */
  seed?: number;
  style?: React.CSSProperties;
}
export function PlayerChip(props: PlayerChipProps): React.JSX.Element;
