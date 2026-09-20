import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Checkbox({ checked, onChange, label, description, disabled, style }) {
  return (
    <label style={{ display: 'flex', gap: 'var(--space-4)', alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, ...style }}>
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked, e)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{
        width: 20, height: 20, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-xs)', marginTop: description ? 2 : 0,
        background: checked ? 'var(--surface-brand)' : 'var(--surface-card)',
        border: '1px solid ' + (checked ? 'var(--brand-700)' : 'var(--border-default)'),
        color: 'var(--white)', transition: 'background var(--dur-fast) var(--ease-out)',
      }}>{checked && <Icon name="check" size={13} />}</span>
      <span>
        <span style={{ font: 'var(--text-body)', display: 'block' }}>{label}</span>
        {description && <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>{description}</span>}
      </span>
    </label>
  );
}
