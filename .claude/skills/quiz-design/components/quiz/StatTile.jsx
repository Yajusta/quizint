import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function StatTile({ label, value, unit, icon, tone = 'light', trend, style }) {
  const dark = tone === 'dark';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-6)',
      background: dark ? 'rgba(255,255,255,.06)' : 'var(--surface-card)',
      border: '1px solid ' + (dark ? 'rgba(255,255,255,.12)' : 'var(--border-subtle)'),
      borderRadius: 'var(--radius-lg)', color: dark ? 'var(--stage-ink)' : 'var(--text-primary)', ...style }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--text-overline)',
        letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
        color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-muted)' }}>
        {icon && <Icon name={icon} size={12} />}{label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ font: 'var(--text-numeric)', fontSize: 32 }}>{value}</span>
        {unit && <span style={{ font: 'var(--text-body-sm)', color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-muted)' }}>{unit}</span>}
      </span>
      {trend && <span style={{ font: 'var(--text-body-sm)', color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-secondary)' }}>{trend}</span>}
    </div>
  );
}
