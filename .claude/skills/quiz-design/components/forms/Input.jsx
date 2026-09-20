import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Input({ icon, error, disabled, size = 'md', style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'lg' ? 'var(--control-h-lg)' : size === 'sm' ? 'var(--control-h-sm)' : 'var(--control-h-md)';
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      {icon && <span style={{ position: 'absolute', left: 12, display: 'flex', color: 'var(--text-muted)' }}><Icon name={icon} size="sm" /></span>}
      <input
        disabled={disabled}
        onFocus={(e) => { setFocus(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur && rest.onBlur(e); }}
        {...rest}
        style={{
          width: '100%', height: h, padding: icon ? '0 12px 0 34px' : '0 12px',
          font: size === 'lg' ? 'var(--text-body-lg)' : 'var(--text-body)', color: 'var(--text-primary)',
          background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
          border: '1px solid ' + (error ? 'var(--state-danger)' : focus ? 'var(--border-brand)' : 'var(--border-default)'),
          borderRadius: 'var(--radius-md)', boxShadow: focus ? 'var(--focus-ring)' : 'none', outline: 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
          ...style,
        }}
      />
    </div>
  );
}
