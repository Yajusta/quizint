// Composant local (plan § 13.1) — la marque est un wordmark typographique, il n'y a pas de logo.
// Specs normatives : « Quizint », Space Grotesk 700, -0.03em, 19/24/32 px, une seule ligne.

import { createElement } from 'react';
import type * as React from 'react';

const WORDMARK_SIZES = { sm: 19, md: 24, lg: 32 } as const;

export interface WordmarkProps {
  /** light = --brand-700 ; dark = --stage-ink. @default 'light' */
  tone?: 'light' | 'dark';
  /** 19 / 24 / 32 px. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Si présent, rend un `<a>` sans soulignement. */
  href?: string;
  /**
   * Patch local (lot 3) : posé sur le `<a>`, permet à l'appelant de confier la navigation au
   * routeur (`e.preventDefault()` puis `navigate`) au lieu de recharger toute l'application.
   */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  style?: React.CSSProperties;
}

export function Wordmark({ tone = 'light', size = 'md', href, onClick, style }: WordmarkProps) {
  const px = WORDMARK_SIZES[size] ?? WORDMARK_SIZES.md;
  const base: React.CSSProperties = {
    display: 'inline-block',
    font: `700 ${px}px/1 var(--font-display)`,
    letterSpacing: '-0.03em',
    whiteSpace: 'nowrap',
    color: tone === 'dark' ? 'var(--stage-ink)' : 'var(--brand-700)',
    ...style,
  };
  if (href) {
    return createElement(
      'a',
      {
        href,
        onClick,
        'aria-label': 'Quizint',
        style: { ...base, borderBottom: 'none', textDecoration: 'none' },
      },
      'Quizint',
    );
  }
  return createElement('span', { 'aria-label': 'Quizint', style: base }, 'Quizint');
}
