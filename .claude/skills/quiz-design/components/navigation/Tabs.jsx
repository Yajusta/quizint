import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Tabs({ tabs = [], value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)', ...style }}>
      {tabs.map((t) => {
        const v = typeof t === 'string' ? t : t.value;
        const l = typeof t === 'string' ? t : t.label;
        const on = value === v;
        return (
          <button key={v} role="tab" aria-selected={on} onClick={() => onChange && onChange(v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 0 10px', border: 0, background: 'transparent',
              font: on ? '600 15px/1 var(--font-sans)' : 'var(--text-body)', color: on ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: '2px solid ' + (on ? 'var(--brand-600)' : 'transparent'), marginBottom: -1, cursor: 'pointer',
              transition: 'color var(--dur-fast) var(--ease-out)' }}>
            {t.icon && <Icon name={t.icon} size="sm" />}{l}
            {t.count != null && <span style={{ font: 'var(--text-numeric)', fontSize: 12, color: 'var(--text-muted)' }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
