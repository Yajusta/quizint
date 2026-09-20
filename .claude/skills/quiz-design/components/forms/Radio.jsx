import React from 'react';

export function Radio({ options = [], value, onChange, name, direction = 'column', style }) {
  return (
    <div role="radiogroup" style={{ display: 'flex', flexDirection: direction, gap: direction === 'row' ? 'var(--space-6)' : 'var(--space-4)', ...style }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const on = value === v;
        return (
          <label key={v} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange && onChange(v)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
            <span style={{
              width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid ' + (on ? 'var(--brand-700)' : 'var(--border-default)'),
              background: 'var(--surface-card)', transition: 'border-color var(--dur-fast) var(--ease-out)',
            }}>
              {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--surface-brand)' }} />}
            </span>
            <span style={{ font: 'var(--text-body)' }}>{l}</span>
          </label>
        );
      })}
    </div>
  );
}
