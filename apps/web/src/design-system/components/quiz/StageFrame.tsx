// Composant local (plan § 13.2) — cadre de l'écran projeté : fond, gouttières, pied fixe à slots.
// Specs normatives : pied 88 px, gouttières 64/80 (40 sous 1100 px), aucun blur ni ombre ici.

import { createContext, useContext } from 'react';
import type * as React from 'react';

import { useMediaQuery } from '../../../lib/useMediaQuery.ts';
import { Icon } from '../core/Icon.tsx';

/**
 * Largeur (px) prise à droite du cadre par un panneau latéral : les seuils de largeur (gouttières,
 * raccourcis) se calculent sur la place réellement laissée au cadre, pas sur la fenêtre.
 */
export const StageInsetContext = createContext(0);

export interface StageKbd {
  key: string;
  label: string;
  /** Rend le raccourci cliquable : un bouton qui déclenche la même action que la touche. */
  onClick?: () => void;
  /** Icône du bouton ; seule avec la touche quand `iconOnly` ou sous 1100 px. */
  icon?: string;
  iconOnly?: boolean;
  /** État d'une bascule (panneau ouvert, plein écran). */
  pressed?: boolean;
}

export interface StageFrameProps {
  children: React.ReactNode;
  /** Pied, gauche — ProgressBar inverse + libellé. */
  progress?: React.ReactNode;
  /** Pied, centre — texte --stage-ink-2, Badge. */
  status?: React.ReactNode;
  /** Pied, droite — Button xl + Button inverse. */
  actions?: React.ReactNode;
  /** Raccourcis affichés à côté des actions ; sous 1100 px, seuls les cliquables restent (icônes). */
  kbd?: StageKbd[];
  /** Centrage vertical du contenu. @default 'center' */
  align?: 'center' | 'start';
  style?: React.CSSProperties;
}

const COMPACT_MAX = 1099;

const kbdKeyStyle: React.CSSProperties = {
  font: 'var(--text-code)',
  fontSize: 12,
  padding: '2px 6px',
  border: '1px solid var(--stage-border)',
  borderRadius: 'var(--radius-xs)',
  color: 'var(--stage-ink-2)',
};

function KbdHint({ k, compact }: { k: StageKbd; compact: boolean }) {
  const key = <kbd style={kbdKeyStyle}>{k.key}</kbd>;
  if (!k.onClick) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          font: 'var(--text-body-sm)',
          color: 'var(--stage-ink-2)',
        }}
      >
        {k.label}
        {key}
      </span>
    );
  }
  const iconOnly = (k.iconOnly || compact) && Boolean(k.icon);
  return (
    <button
      type="button"
      onClick={k.onClick}
      aria-pressed={k.pressed}
      aria-label={iconOnly ? k.label : undefined}
      title={k.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        minHeight: 40,
        padding: '0 var(--space-3)',
        font: 'var(--text-body-sm)',
        color: 'var(--stage-ink)',
        background: k.pressed ? 'var(--stage-control-hover)' : 'var(--stage-control)',
        border: '1px solid var(--stage-border-strong)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {k.icon && <Icon name={k.icon} size="sm" />}
      {!iconOnly && k.label}
      {key}
    </button>
  );
}

export function StageFrame({
  children,
  progress,
  status,
  actions,
  kbd,
  align = 'center',
  style,
}: StageFrameProps) {
  const inset = useContext(StageInsetContext);
  const compact = useMediaQuery(`(max-width: ${COMPACT_MAX + inset}px)`);
  const shownKbd = (kbd ?? []).filter((k) => !compact || k.onClick);
  const hasFooter = Boolean(progress || status || actions);
  const gutter = compact ? 'var(--space-9)' : 'var(--space-12)';
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateRows: '1fr auto',
        background: 'var(--stage-bg)',
        color: 'var(--stage-ink)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <main
        style={{
          padding: compact ? 'var(--space-9) var(--space-9)' : 'var(--space-11) var(--space-12)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: align === 'start' ? 'flex-start' : 'center',
          minHeight: 0,
        }}
      >
        {children}
      </main>
      {hasFooter && (
        <footer
          style={{
            height: 88,
            padding: `0 ${gutter}`,
            borderTop: '1px solid var(--stage-border)',
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, auto) 1fr auto',
            gap: 'var(--space-7)',
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>{progress}</div>
          <div style={{ minWidth: 0, color: 'var(--stage-ink-2)' }}>{status}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            {shownKbd.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {shownKbd.map((k) => (
                  <KbdHint key={k.key} k={k} compact={compact} />
                ))}
              </span>
            )}
            {actions}
          </div>
        </footer>
      )}
    </div>
  );
}
