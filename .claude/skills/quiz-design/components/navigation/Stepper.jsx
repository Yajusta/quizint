import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Stepper({ steps = [], current = 0, style }) {
  return (
    <ol style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', listStyle: 'none', margin: 0, padding: 0, ...style }}>
      {steps.map((s, i) => {
        const done = i < current, on = i === current;
        return (
          <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--surface-brand)' : on ? 'var(--surface-card)' : 'var(--gray-100)',
                border: '1px solid ' + (done ? 'var(--brand-700)' : on ? 'var(--border-brand)' : 'var(--border-subtle)'),
                color: done ? 'var(--white)' : on ? 'var(--text-brand)' : 'var(--text-muted)',
                font: 'var(--text-numeric)', fontSize: 11 }}>
                {done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span style={{ font: on ? '600 14px/1 var(--font-sans)' : 'var(--text-body-sm)', color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s}</span>
            </span>
            {i < steps.length - 1 && <span style={{ width: 28, height: 1, background: 'var(--border-default)' }} />}
          </li>
        );
      })}
    </ol>
  );
}
