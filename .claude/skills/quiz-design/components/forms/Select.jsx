import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Select({ options = [], error, disabled, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <select
        disabled={disabled}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        {...rest}
        style={{
          width: '100%', height: 'var(--control-h-md)', padding: '0 34px 0 12px',
          font: 'var(--text-body)', color: 'var(--text-primary)', appearance: 'none',
          background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
          border: '1px solid ' + (error ? 'var(--state-danger)' : focus ? 'var(--border-brand)' : 'var(--border-default)'),
          borderRadius: 'var(--radius-md)', boxShadow: focus ? 'var(--focus-ring)' : 'none', outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer', ...style,
        }}
      >
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
      <span style={{ position: 'absolute', right: 11, pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex' }}>
        <Icon name="chevron-down" size="sm" />
      </span>
    </div>
  );
}
