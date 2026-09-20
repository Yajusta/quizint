import React from 'react';
import { Icon } from '../core/Icon.tsx';

export function StatTile({ label, value, unit, icon, tone = 'light', trend, style, ...rest }) {
  const dark = tone === 'dark';
  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-6)',
      background: dark ? 'var(--stage-panel)' : 'var(--surface-card)',
      border: '1px solid ' + (dark ? 'var(--stage-border)' : 'var(--border-subtle)'),
      borderRadius: 'var(--radius-lg)', color: dark ? 'var(--stage-ink)' : 'var(--text-primary)', ...style }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6,
        font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
        color: dark ? 'var(--stage-ink-2)' : 'var(--text-muted)' }}>
        {icon && <Icon name={icon} size={12} />}{label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ font: 'var(--text-numeric)', fontSize: 32 }}>{value}</span>
        {unit && <span style={{ font: 'var(--text-body-sm)', color: dark ? 'var(--stage-ink-2)' : 'var(--text-muted)' }}>{unit}</span>}
      </span>
      {trend && <span style={{ font: 'var(--text-body-sm)', color: dark ? 'var(--stage-ink-2)' : 'var(--text-secondary)' }}>{trend}</span>}
    </div>
  );
}
