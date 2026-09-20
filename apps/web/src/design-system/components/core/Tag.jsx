import React from 'react';
import { Icon } from './Icon.tsx';

export function Tag({ children, onRemove, selected, onClick, style, ...rest }) {
  return (
    <span {...rest} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: onRemove ? '0 6px 0 10px' : '0 10px',
      borderRadius: 'var(--radius-sm)',
      background: selected ? 'var(--brand-50)' : 'var(--surface-card)',
      border: `1px solid ${selected ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
      color: selected ? 'var(--text-brand)' : 'var(--text-secondary)',
      font: 'var(--text-body-sm)', cursor: onClick ? 'pointer' : 'default',
      transition: 'background var(--dur-fast) var(--ease-out)', ...style,
    }}>
      {children}
      {onRemove && (
        <button type="button" aria-label="Retirer" onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{ display: 'inline-flex', border: 0, background: 'transparent', padding: 2, cursor: 'pointer', color: 'inherit' }}>
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  );
}
