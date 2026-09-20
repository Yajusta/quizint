import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

export function Dialog({ open = true, title, description, footer, onClose, width = 480, children, style }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', zIndex: 40 }}>
      <div role="dialog" aria-modal="true" style={{ width, maxWidth: '100%', background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-3)', overflow: 'hidden', ...style }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', padding: 'var(--space-7) var(--space-7) var(--space-5)' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ font: 'var(--text-h2)', letterSpacing: 'var(--tracking-tight)' }}>{title}</h2>
            {description && <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 6 }}>{description}</p>}
          </div>
          {onClose && <IconButton icon="x" label="Fermer" variant="ghost" size="sm" onClick={onClose} />}
        </header>
        {children && <div style={{ padding: '0 var(--space-7) var(--space-7)' }}>{children}</div>}
        {footer && <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-7)', borderTop: '1px solid var(--border-subtle)', background: 'var(--gray-50)' }}>{footer}</footer>}
      </div>
    </div>
  );
}
