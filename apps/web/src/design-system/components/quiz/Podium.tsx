// Composant local (plan § 13.3) — podium 2-1-3 du classement final sur le stage.
// Specs normatives : blocs 240/200/200 × 200/140/110, révélation 3 → 2 → 1 à 0 / 600 / 1 200 ms,
// déplacement en --ease-spring (l'opacité en --ease-out), CountUp au posé, onRevealed à 2 400 ms,
// affichage direct sous prefers-reduced-motion, role=list / listitem avec ordinal localise.

import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';

import { formatScore, ordinal } from '../../../lib/format.ts';
import { prefersReducedMotion } from '../../../lib/useMediaQuery.ts';
import { Icon } from '../core/Icon.tsx';
import { CountUp } from '../motion/CountUp.tsx';

export interface PodiumEntry {
  rank: 1 | 2 | 3;
  name: string;
  score: number;
}

export interface PodiumProps {
  /** 1 à 3 entrées ; les rangs manquants ne rendent pas de bloc. */
  entries: PodiumEntry[];
  /** Séquence de révélation au montage. @default true */
  reveal?: boolean;
  /** Fin de la séquence (ou immédiatement sans reveal / sous reduced-motion). */
  onRevealed?: () => void;
  style?: React.CSSProperties;
}

const BLOCK = {
  1: { width: 240, height: 200, border: 'var(--stage-border-strong)', name: 'var(--text-h2)', score: 28 },
  2: { width: 200, height: 140, border: 'var(--stage-border)', name: 'var(--text-h3)', score: 22 },
  3: { width: 200, height: 110, border: 'var(--stage-border)', name: 'var(--text-h3)', score: 22 },
} as const;

/** Ordre visuel gauche → droite : rang 2, rang 1, rang 3. */
const VISUAL_ORDER: ReadonlyArray<1 | 2 | 3> = [2, 1, 3];
/** Instant de révélation par rang (ms). */
const REVEAL_AT: Record<1 | 2 | 3, number> = { 3: 0, 2: 600, 1: 1200 };
const STEP = 600;
const DONE_AT = 2400;

export function Podium({ entries, reveal = true, onRevealed, style }: PodiumProps) {
  const { t } = useTranslation('common');
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const revealKey = entries.map((e) => `${e.rank}:${e.name}:${e.score}`).join('|');
  const instant = !reveal || prefersReducedMotion();

  // `shown` : la colonne est arrivée ; `landed` : son mouvement est terminé (le CountUp démarre).
  const [shown, setShown] = useState<Set<number>>(() => (instant ? new Set([1, 2, 3]) : new Set()));
  const [landed, setLanded] = useState<Set<number>>(() => (instant ? new Set([1, 2, 3]) : new Set()));
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  useEffect(() => {
    if (instant) {
      setShown(new Set([1, 2, 3]));
      setLanded(new Set([1, 2, 3]));
      onRevealedRef.current?.();
      return undefined;
    }
    setShown(new Set());
    setLanded(new Set());
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const rank of [3, 2, 1] as const) {
      const at = REVEAL_AT[rank];
      timers.push(setTimeout(() => setShown((prev) => new Set(prev).add(rank)), at));
      timers.push(setTimeout(() => setLanded((prev) => new Set(prev).add(rank)), at + STEP));
    }
    timers.push(setTimeout(() => onRevealedRef.current?.(), DONE_AT));
    return () => timers.forEach(clearTimeout);
  }, [revealKey, instant]);

  return (
    <div
      role="list"
      aria-label="Podium"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 'var(--space-7)',
        ...style,
      }}
    >
      {VISUAL_ORDER.map((rank) => {
        const entry = byRank.get(rank);
        const spec = BLOCK[rank];
        if (!entry) {
          // Rang 3 absent avec deux entrées : l'emplacement reste vide pour garder le 1er au centre,
          // sans bloc fantôme. Rang 2 absent (une seule entrée) : rien, le 1er est seul et centré.
          return rank === 3 && byRank.size === 2 ? (
            <span key={rank} aria-hidden style={{ width: spec.width, flex: '0 0 auto' }} />
          ) : null;
        }
        const visible = shown.has(rank);
        const first = rank === 1;
        return (
          <div
            key={rank}
            role="listitem"
            aria-label={`${ordinal(rank)}, ${entry.name}, ${formatScore(entry.score)} ${t('units.points')}`}
            style={{
              width: spec.width,
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-2)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(24px)',
              // Le ressort ne porte que le déplacement ; l'opacité suit la courbe standard.
              transition: `transform ${STEP}ms var(--ease-spring), opacity ${STEP}ms var(--ease-out)`,
            }}
          >
            {first && <Icon name="trophy" size={28} color="var(--brand-300)" />}
            <span
              style={{
                font: spec.name,
                letterSpacing: first ? 'var(--tracking-tight)' : undefined,
                textAlign: 'center',
                textWrap: 'balance',
                overflowWrap: 'anywhere',
                maxWidth: '100%',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {entry.name}
            </span>
            <CountUp value={landed.has(rank) ? entry.score : 0} style={{ fontSize: spec.score }} />
            <div
              aria-hidden
              style={{
                marginTop: 'var(--space-4)',
                width: '100%',
                height: spec.height,
                background: 'var(--stage-panel)',
                border: `1px solid ${spec.border}`,
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: 'var(--text-numeric-xl)',
                fontSize: 48,
                color: first ? 'var(--brand-300)' : 'var(--stage-ink)',
              }}
            >
              {rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}
