import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function LeaderboardRow({ rank = 1, name = 'Participant', score = 0, delta, tone = 'light', highlight, style }) {
  const dark = tone === 'dark';
  const medal = rank <= 3;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', height: 56, padding: '0 var(--space-5)',
      borderRadius: 'var(--radius-md)',
      background: highlight ? (dark ? 'rgba(179,159,208,.16)' : 'var(--surface-brand-soft)') : (dark ? 'rgba(255,255,255,.06)' : 'var(--surface-card)'),
      border: '1px solid ' + (highlight ? (dark ? 'rgba(179,159,208,.4)' : 'var(--border-brand)') : (dark ? 'rgba(255,255,255,.12)' : 'var(--border-subtle)')),
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)', ...style }}>
      <span style={{ width: 28, textAlign: 'center', font: 'var(--text-numeric)',
        color: medal ? (dark ? 'var(--brand-300)' : 'var(--text-brand)') : (dark ? 'rgba(239,234,246,.6)' : 'var(--text-muted)') }}>{rank}</span>
      <span style={{ flex: 1, font: 'var(--text-body-lg)', fontWeight: highlight ? 600 : 400 }}>{name}</span>
      {delta != null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--text-body-sm)',
          color: delta >= 0 ? 'var(--state-success)' : 'var(--state-danger)' }}>
          <Icon name={delta >= 0 ? 'arrow-up' : 'arrow-down'} size={12} />{Math.abs(delta)}
        </span>
      )}
      <span style={{ font: 'var(--text-numeric)', minWidth: 64, textAlign: 'right' }}>{score.toLocaleString('fr-FR')}</span>
    </div>
  );
}
