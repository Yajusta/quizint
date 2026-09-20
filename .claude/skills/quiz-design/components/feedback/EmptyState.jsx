import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function EmptyState({ icon = 'inbox', title, description, action, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 'var(--space-4)', padding: 'var(--space-10) var(--space-7)', ...style }}>
      <span style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: 'var(--surface-brand-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-brand)' }}>
        <Icon name={icon} size="lg" />
      </span>
      <h3 style={{ font: 'var(--text-h3)' }}>{title}</h3>
      {description && <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', maxWidth: 380 }}>{description}</p>}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  );
}
