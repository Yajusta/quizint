import React from 'react';

export function Switch({ checked, onChange, label, disabled, style }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, ...style }}>
      <input type="checkbox" role="switch" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{
        width: 40, height: 24, borderRadius: 'var(--radius-full)', padding: 3, flex: '0 0 auto',
        background: checked ? 'var(--surface-brand)' : 'var(--gray-300)',
        transition: 'background var(--dur-base) var(--ease-out)', display: 'flex',
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', background: 'var(--white)', boxShadow: 'var(--shadow-1)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform var(--dur-base) var(--ease-out)',
        }} />
      </span>
      {label && <span style={{ font: 'var(--text-body)' }}>{label}</span>}
    </label>
  );
}
