import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* No per-option colour. Question phase: proposition | selected. Answer phase: correct | wrong | muted. */
const answerStates = {
  default: { bg: 'var(--answer-rest-bg, #FFFFFF)', border: 'var(--answer-rest-border, #C6CBD1)', width: 1, tile: 'var(--answer-rest-tile, #EFF1F3)', tileInk: 'var(--answer-rest-tile-ink, #3A4048)', ink: 'var(--text-primary)' },
  selected: { bg: 'var(--answer-selected-bg, #F5F1FA)', border: 'var(--answer-selected-border, #4A2E6B)', width: 2, tile: 'var(--brand-700, #4A2E6B)', tileInk: 'var(--white, #FFFFFF)', ink: 'var(--text-primary)' },
  correct: { bg: 'var(--answer-correct-bg, #DCF1E7)', border: 'var(--answer-correct-border, #1B8A5A)', width: 2, tile: 'var(--green-600, #1B8A5A)', tileInk: 'var(--white, #FFFFFF)', ink: 'var(--text-primary)' },
  wrong: { bg: 'var(--answer-wrong-bg, #F8E3E0)', border: 'var(--answer-wrong-border, #BE3A2B)', width: 2, tile: 'var(--red-600, #BE3A2B)', tileInk: 'var(--white, #FFFFFF)', ink: 'var(--text-primary)' },
  muted: { bg: 'var(--gray-50, #F7F8F9)', border: 'var(--border-subtle, #E2E5E9)', width: 1, tile: 'var(--gray-200, #E2E5E9)', tileInk: 'var(--text-muted, #6A7280)', ink: 'var(--text-secondary)' },
};

export function AnswerOption({ letter = 'A', children, state = 'default', size = 'md', distribution, onClick, style, ...rest }) {
  const s = answerStates[state] || answerStates.default;
  const [hover, setHover] = React.useState(false);
  const minH = size === 'lg' ? 96 : size === 'sm' ? 52 : 68;
  const barFill = state === 'correct' ? 'var(--green-600)' : state === 'wrong' ? 'var(--red-600)' : 'var(--gray-400)';
  return (
    <button type="button" onClick={onClick} disabled={state === 'muted'}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: size === 'lg' ? 'var(--space-6)' : 'var(--space-5)',
        width: '100%', minHeight: minH, padding: size === 'lg' ? 'var(--space-6)' : 'var(--space-5)',
        background: hover && state === 'default' ? 'var(--gray-50)' : s.bg,
        border: `${s.width}px solid ${s.border}`, borderRadius: 'var(--radius-lg)',
        textAlign: 'left', color: s.ink,
        cursor: onClick && state !== 'muted' ? 'pointer' : 'default',
        opacity: state === 'muted' ? 0.7 : 1,
        boxShadow: hover && state === 'default' ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transform: hover && state === 'default' ? 'translateY(-1px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
        overflow: 'hidden', ...style }}>
      <span style={{ width: size === 'lg' ? 48 : 36, height: size === 'lg' ? 48 : 36, flex: '0 0 auto',
        borderRadius: 'var(--radius-md)', background: s.tile, color: s.tileInk,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: 'var(--text-numeric)', fontSize: size === 'lg' ? 22 : 17,
        transition: 'background var(--dur-base) var(--ease-out)' }}>{letter}</span>
      <span style={{ flex: 1, font: size === 'lg' ? '500 24px/1.3 var(--font-sans)' : 'var(--text-body-lg)' }}>{children}</span>
      {distribution != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: '0 0 auto' }}>
          <span style={{ width: size === 'lg' ? 160 : 96, height: 8, borderRadius: 'var(--radius-full)', background: 'var(--gray-200)', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: distribution + '%', height: '100%', background: barFill,
              transition: 'width var(--dur-slow) var(--ease-out)' }} />
          </span>
          <span style={{ font: 'var(--text-numeric)', color: 'var(--text-secondary)', minWidth: 46, textAlign: 'right' }}>{distribution}%</span>
        </span>
      )}
      {state === 'correct' && <Icon name="check" size="lg" color="var(--green-600)" />}
      {state === 'wrong' && <Icon name="x" size="lg" color="var(--red-600)" />}
    </button>
  );
}
