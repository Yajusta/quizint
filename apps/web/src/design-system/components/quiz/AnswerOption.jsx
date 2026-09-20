import React from 'react';
import { Icon } from '../core/Icon.tsx';

const NBSP = '\u00a0';

/* No per-option colour. Question phase: proposition | selected. Answer phase: correct | wrong | muted.
   Patchs locaux (§ 4.2) : plus de repli hexadécimal en dur (un seul jeu de tokens ici),
   `disabled` explicite (le kit le déduisait de `muted`), tuile-lettre ronde, prop `check`.
   Patch lot 2 : en size=lg (stage) la barre de distribution passe à 240 × 10 px (lisible du fond de la
   salle) ; espace insécable avant « % » (typographie FR, même correctif que le lot 3). */
const answerStates = {
  default: { bg: 'var(--answer-rest-bg)', border: 'var(--answer-rest-border)', width: 1, tile: 'var(--answer-rest-tile)', tileInk: 'var(--answer-rest-tile-ink)', ink: 'var(--text-primary)' },
  selected: { bg: 'var(--answer-selected-bg)', border: 'var(--answer-selected-border)', width: 2, tile: 'var(--brand-700)', tileInk: 'var(--white)', ink: 'var(--text-primary)' },
  correct: { bg: 'var(--answer-correct-bg)', border: 'var(--answer-correct-border)', width: 2, tile: 'var(--green-600)', tileInk: 'var(--white)', ink: 'var(--text-primary)' },
  wrong: { bg: 'var(--answer-wrong-bg)', border: 'var(--answer-wrong-border)', width: 2, tile: 'var(--red-600)', tileInk: 'var(--white)', ink: 'var(--text-primary)' },
  muted: { bg: 'var(--gray-50)', border: 'var(--border-subtle)', width: 1, tile: 'var(--gray-200)', tileInk: 'var(--text-muted)', ink: 'var(--text-secondary)' },
};

export function AnswerOption({ letter = 'A', children, state = 'default', size = 'md', distribution, check, disabled, onClick, style, ...rest }) {
  const s = answerStates[state] || answerStates.default;
  const [hover, setHover] = React.useState(false);
  const minH = size === 'lg' ? 96 : size === 'sm' ? 52 : 68;
  const barFill = state === 'correct' ? 'var(--green-600)' : state === 'wrong' ? 'var(--red-600)' : 'var(--gray-400)';
  const tilePx = size === 'lg' ? 48 : 36;
  const liftable = hover && state === 'default' && !disabled;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: size === 'lg' ? 'var(--space-6)' : 'var(--space-5)',
        width: '100%', minHeight: minH, padding: size === 'lg' ? 'var(--space-6)' : 'var(--space-5)',
        background: liftable ? 'var(--gray-50)' : s.bg,
        border: `${s.width}px solid ${s.border}`, borderRadius: 'var(--radius-lg)',
        textAlign: 'left', color: s.ink,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        opacity: state === 'muted' ? 0.7 : 1,
        boxShadow: liftable ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transform: liftable ? 'translateY(-1px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
        overflow: 'hidden', ...style }}>
      <span style={{ width: tilePx, height: tilePx, flex: '0 0 auto',
        borderRadius: 'var(--radius-full)', background: s.tile, color: s.tileInk,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: 'var(--text-numeric)', fontSize: size === 'lg' ? 22 : 17,
        transition: 'background var(--dur-base) var(--ease-out)' }}>
        {check ? <Icon name="check" size={size === 'lg' ? 'lg' : 'md'} /> : letter}
      </span>
      <span style={{ flex: 1, font: size === 'lg' ? '500 24px/1.3 var(--font-sans)' : 'var(--text-body-lg)' }}>{children}</span>
      {distribution != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: '0 0 auto' }}>
          <span style={{ width: size === 'lg' ? 240 : 96, height: size === 'lg' ? 10 : 8, borderRadius: 'var(--radius-full)', background: 'var(--gray-200)', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: distribution + '%', height: '100%', background: barFill,
              transition: 'width var(--dur-slow) var(--ease-out)' }} />
          </span>
          <span style={{ font: 'var(--text-numeric)', color: 'var(--text-secondary)', minWidth: 46, textAlign: 'right' }}>{distribution}{NBSP}%</span>
        </span>
      )}
      {state === 'correct' && <Icon name="check" size="lg" color="var(--green-600)" />}
      {state === 'wrong' && <Icon name="x" size="lg" color="var(--red-600)" />}
    </button>
  );
}
