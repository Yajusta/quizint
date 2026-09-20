import React from 'react';
import { Icon } from '../core/Icon.tsx';

/* Patch lot 5 (§ 12) : même correctif que `Switch` — plus d'`opacity` pour l'état désactivé,
   mais la pastille `--gray-100` / bordure `--border-subtle` / encre `--text-muted` du système. */
export function Checkbox({ checked, onChange, label, description, disabled, style, ...rest }) {
  return (
    <label {...rest} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', ...style }}>
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked, e)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{
        width: 20, height: 20, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-xs)', marginTop: description ? 2 : 0,
        background: disabled ? 'var(--gray-100)' : checked ? 'var(--surface-brand)' : 'var(--surface-card)',
        border: '1px solid ' + (disabled ? 'var(--border-subtle)' : checked ? 'var(--brand-700)' : 'var(--border-default)'),
        color: disabled ? 'var(--text-muted)' : 'var(--white)', transition: 'background var(--dur-fast) var(--ease-out)',
      }}>{checked && <Icon name="check" size={13} />}</span>
      <span>
        <span style={{ font: 'var(--text-body)', display: 'block', color: disabled ? 'var(--text-muted)' : undefined }}>{label}</span>
        {description && <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>{description}</span>}
      </span>
    </label>
  );
}
