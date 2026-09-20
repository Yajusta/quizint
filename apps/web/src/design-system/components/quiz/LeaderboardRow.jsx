import React from 'react';
import { Icon } from '../core/Icon.tsx';
import { formatScore } from '../../../lib/format.ts';

/* Patch lot 2 : `score` accepte un nœud React (CountUp des scores du top 5 sur le stage).
   Patch lot 5 : un score négatif passait par `toLocaleString` et s'affichait avec un trait
   d'union U+002D ; `lib/format-fr` est la seule source du formatage FR du produit, et il rend
   le vrai signe moins U+2212 avec une espace insécable. */

export function LeaderboardRow({ rank = 1, name = 'Participant', score = 0, delta, tone = 'light', highlight, style, ...rest }) {
  const dark = tone === 'dark';
  const medal = rank <= 3;
  return (
    <div {...rest} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', height: 56, padding: '0 var(--space-5)',
      borderRadius: 'var(--radius-md)',
      background: highlight ? (dark ? 'var(--stage-brand-soft)' : 'var(--surface-brand-soft)') : (dark ? 'var(--stage-panel)' : 'var(--surface-card)'),
      border: '1px solid ' + (highlight ? (dark ? 'var(--stage-brand-border)' : 'var(--border-brand)') : (dark ? 'var(--stage-border)' : 'var(--border-subtle)')),
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)', ...style }}>
      <span style={{ width: 28, textAlign: 'center', font: 'var(--text-numeric)',
        color: medal ? (dark ? 'var(--brand-300)' : 'var(--text-brand)') : (dark ? 'var(--stage-ink-2)' : 'var(--text-muted)') }}>{rank}</span>
      <span style={{ flex: 1, font: 'var(--text-body-lg)', fontWeight: highlight ? 600 : 400 }}>{name}</span>
      {delta != null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--text-body-sm)',
          color: delta >= 0 ? 'var(--state-success)' : 'var(--state-danger)' }}>
          <Icon name={delta >= 0 ? 'arrow-up' : 'arrow-down'} size={12} />{Math.abs(delta)}
        </span>
      )}
      <span style={{ font: 'var(--text-numeric)', minWidth: 64, textAlign: 'right' }}>{typeof score === 'number' ? formatScore(score) : score}</span>
    </div>
  );
}
