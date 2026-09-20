// Composant local (plan § 13.1) — la marque est un wordmark typographique doublé du pictogramme
// « point d'interrogation » (`apps/web/public/quizint.png`).
// Specs normatives : « Quizint », Space Grotesk 700, -0.03em, 19/24/32 px, une seule ligne.

import { createElement } from 'react';
import type * as React from 'react';

const WORDMARK_SIZES = { sm: 19, md: 24, lg: 32 } as const;

/** Ratio natif du pictogramme (256 × 314). */
const MARK_RATIO = 256 / 314;
/** Le violet du logo disparaît sur `--stage-bg` : la variante claire repeint cette moitié. */
const MARK_SRC = { light: '/quizint.png', dark: '/quizint-light.png' } as const;

export interface WordmarkProps {
  /** light = --brand-700 ; dark = --stage-ink. @default 'light' */
  tone?: 'light' | 'dark';
  /** 19 / 24 / 32 px. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Patch local (lot 5) : affiche le pictogramme à gauche du mot. `false` laisse le wordmark
   * purement typographique d'origine.
   * @default true
   */
  mark?: boolean;
  /** Si présent, rend un `<a>` sans soulignement. */
  href?: string;
  /**
   * Patch local (lot 3) : posé sur le `<a>`, permet à l'appelant de confier la navigation au
   * routeur (`e.preventDefault()` puis `navigate`) au lieu de recharger toute l'application.
   */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  style?: React.CSSProperties;
}

export function Wordmark({ tone = 'light', size = 'md', mark = true, href, onClick, style }: WordmarkProps) {
  const px = WORDMARK_SIZES[size] ?? WORDMARK_SIZES.md;
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: Math.round(px * 0.35),
    font: `700 ${px}px/1 var(--font-display)`,
    letterSpacing: '-0.03em',
    whiteSpace: 'nowrap',
    color: tone === 'dark' ? 'var(--stage-ink)' : 'var(--brand-700)',
    ...style,
  };
  // Le mot porte déjà la marque : le pictogramme est décoratif pour un lecteur d'écran.
  const markHeight = Math.round(px * 1.2);
  const children = mark
    ? [
        createElement('img', {
          key: 'mark',
          src: MARK_SRC[tone],
          alt: '',
          'aria-hidden': true,
          width: Math.round(markHeight * MARK_RATIO),
          height: markHeight,
          style: { display: 'block', height: markHeight, width: 'auto' },
        }),
        'Quizint',
      ]
    : 'Quizint';

  if (href) {
    return createElement(
      'a',
      {
        href,
        onClick,
        'aria-label': 'Quizint',
        style: { ...base, borderBottom: 'none', textDecoration: 'none' },
      },
      children,
    );
  }
  return createElement('span', { 'aria-label': 'Quizint', style: base }, children);
}
