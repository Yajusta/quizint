import React from 'react';

/* Patch lot 5 (§ 12 « opacity pour un état désactivé ») : le kit posait `opacity: .55` sur tout le
   composant. Remplacé par le vrai état désactivé du système — piste `--gray-100`, bordure
   `--border-subtle`, pastille `--gray-400`, libellé `--text-muted`. La bordure est toujours
   présente (transparente au repos) pour que la géométrie ne bouge pas entre les deux états. */
export function Switch({ checked, onChange, label, disabled, style, ...rest }) {
  return (
    <label {...rest} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)',
      cursor: disabled ? 'not-allowed' : 'pointer', ...style }}>
      <input type="checkbox" role="switch" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{
        width: 40, height: 24, borderRadius: 'var(--radius-full)', padding: 3, flex: '0 0 auto',
        boxSizing: 'border-box',
        background: disabled ? 'var(--gray-100)' : checked ? 'var(--surface-brand)' : 'var(--gray-300)',
        border: '1px solid ' + (disabled ? 'var(--border-subtle)' : 'transparent'),
        transition: 'background var(--dur-base) var(--ease-out)', display: 'flex',
      }}>
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          background: disabled ? 'var(--gray-400)' : 'var(--white)',
          boxShadow: disabled ? 'none' : 'var(--shadow-1)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform var(--dur-base) var(--ease-out)',
        }} />
      </span>
      {label && <span style={{ font: 'var(--text-body)', color: disabled ? 'var(--text-muted)' : undefined }}>{label}</span>}
    </label>
  );
}
