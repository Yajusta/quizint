import React from 'react';

function initials(name) {
  return name.split(/[\s-]+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
const chipTints = ['var(--brand-700)', 'var(--brand-500)', 'var(--gray-600)', 'var(--brand-800)', 'var(--gray-800)'];

export function PlayerChip({ name = 'Participant', tone = 'light', seed = 0, style, ...rest }) {
  const dark = tone === 'dark';
  return (
    <span {...rest} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', height: 36, padding: '0 12px 0 4px',
      borderRadius: 'var(--radius-full)',
      background: dark ? 'var(--stage-panel-2)' : 'var(--surface-card)',
      border: '1px solid ' + (dark ? 'var(--stage-border-2)' : 'var(--border-subtle)'),
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)', font: 'var(--text-body)', ...style }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: chipTints[seed % chipTints.length],
        color: 'var(--white)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: '600 12px/1 var(--font-sans)' }}>{initials(name)}</span>
      {name}
    </span>
  );
}
