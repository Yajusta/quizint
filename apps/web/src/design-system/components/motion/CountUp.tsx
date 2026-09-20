// Composant local (plan § 13.4) — compteur mono animé à la révélation d'une valeur.
// Specs normatives : 600 ms, easeOutCubic (aucun dépassement), format fr-FR,
// reprise depuis la valeur affichée, coupé sous prefers-reduced-motion.

import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';

import { formatScore } from '../../../lib/format.ts';
import { prefersReducedMotion } from '../../../lib/useMediaQuery.ts';

export interface CountUpProps {
  /** Valeur cible. */
  value: number;
  /** Départ ; défaut = dernière valeur rendue, sinon 0. */
  from?: number;
  /** Durée en ms. @default 600 */
  duration?: number;
  /** @default (n) => formatScore(Math.round(n)) — `fr-FR`, vrai moins U+2212 si négatif */
  format?: (n: number) => string;
  /** Ex. « + » ou « − » — le signe est fourni par l'appelant. */
  prefix?: string;
  style?: React.CSSProperties;
}

// Patch lot 5 : le défaut du § 13.4 (`toLocaleString('fr-FR')`) rend un score négatif avec le
// trait d'union U+002D. Le formatage FR du produit passe par `lib/format-fr`, seul endroit où
// vit le vrai signe moins — le podium compte des scores qui peuvent l'être.
const defaultFormat = (n: number) => formatScore(Math.round(n));

export function CountUp({
  value,
  from,
  duration = 600,
  format = defaultFormat,
  prefix = '',
  style,
}: CountUpProps) {
  const [shown, setShown] = useState(() => from ?? value);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const start = from ?? shownRef.current;
    if (duration <= 0 || prefersReducedMotion() || start === value) {
      setShown(value);
      return undefined;
    }
    let frame = 0;
    let t0 = 0;
    const step = (now: number) => {
      if (t0 === 0) t0 = now;
      const t = Math.min(1, (now - t0) / duration);
      // easeOutCubic : pas de dépassement, un chiffre qui redescend se lit comme un bug.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(start + (value - start) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else setShown(value);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `from` volontairement hors dépendances : la reprise part de la valeur affichée courante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const final = prefix + format(value);
  return (
    <span
      aria-label={final}
      aria-live="off"
      style={{ font: 'var(--text-numeric)', fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {prefix + format(shown)}
    </span>
  );
}
