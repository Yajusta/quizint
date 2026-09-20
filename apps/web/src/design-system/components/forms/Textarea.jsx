import React from 'react';

export function Textarea({ error, disabled, rows = 4, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea
      rows={rows} disabled={disabled}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      {...rest}
      style={{
        width: '100%', padding: '10px 12px', font: 'var(--text-body)', color: 'var(--text-primary)',
        background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
        border: '1px solid ' + (error ? 'var(--state-danger)' : focus ? 'var(--border-brand)' : 'var(--border-default)'),
        borderRadius: 'var(--radius-md)', boxShadow: focus ? 'var(--focus-ring)' : 'none',
        outline: 'none', resize: 'vertical', fontFamily: 'var(--font-sans)',
        transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        ...style,
      }}
    />
  );
}
