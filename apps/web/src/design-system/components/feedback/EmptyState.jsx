import React from 'react';
import { Icon } from '../core/Icon.tsx';

/* Patch lot 2 : tone=dark — variante stage (fond --stage-panel-2, encre --stage-ink / --stage-ink-2). */
export function EmptyState({ icon = 'inbox', title, description, action, tone = 'light', style, ...rest }) {
  const dark = tone === 'dark';
  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 'var(--space-4)', padding: 'var(--space-10) var(--space-7)', color: dark ? 'var(--stage-ink)' : undefined, ...style }}>
      <span style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: dark ? 'var(--stage-panel-2)' : 'var(--surface-brand-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? 'var(--brand-300)' : 'var(--text-brand)' }}>
        <Icon name={icon} size="lg" />
      </span>
      <h3 style={{ font: 'var(--text-h3)' }}>{title}</h3>
      {description && <p style={{ font: 'var(--text-body)', color: dark ? 'var(--stage-ink-2)' : 'var(--text-secondary)', maxWidth: 380 }}>{description}</p>}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  );
}
