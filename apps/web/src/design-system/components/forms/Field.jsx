import React from 'react';

export function Field({ label, hint, error, required, htmlFor, children, style, ...rest }) {
  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }}>
      {label && (
        <label htmlFor={htmlFor} style={{ font: 'var(--text-label)', color: 'var(--text-primary)', display: 'flex', gap: 4 }}>
          {label}{required && <span style={{ color: 'var(--state-danger)' }}>*</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p style={{ font: 'var(--text-body-sm)', color: error ? 'var(--state-danger)' : 'var(--text-muted)' }}>{error || hint}</p>
      )}
    </div>
  );
}
