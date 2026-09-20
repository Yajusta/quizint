import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function SideNav({ items = [], value, onChange, header, footer, width = 232, style }) {
  return (
    <nav style={{ width, flex: '0 0 auto', background: 'var(--surface-card)', borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', padding: 'var(--space-6) var(--space-4)', gap: 'var(--space-6)', ...style }}>
      {header && <div style={{ padding: '0 var(--space-3)' }}>{header}</div>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map((it) => {
          const on = value === it.value;
          return (
            <li key={it.value}>
              <button onClick={() => onChange && onChange(it.value)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', height: 36, padding: '0 var(--space-4)',
                  border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                  background: on ? 'var(--surface-brand-soft)' : 'transparent',
                  color: on ? 'var(--text-brand)' : 'var(--text-secondary)',
                  font: on ? '500 14px/1 var(--font-sans)' : 'var(--text-body)',
                  transition: 'background var(--dur-fast) var(--ease-out)' }}>
                <Icon name={it.icon} size="sm" />
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.count != null && <span style={{ font: 'var(--text-numeric)', fontSize: 12, color: 'var(--text-muted)' }}>{it.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {footer}
    </nav>
  );
}
