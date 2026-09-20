import React from 'react';
import { Icon } from '../core/Icon.tsx';

/* Patchs locaux (§ 4.2, lot 1) : taille `xl` (64 px — saisie du code et réponse numérique côté
   participant) ; `{...rest}` avant les handlers de focus (sinon un onFocus/onBlur de l'appelant
   écrasait le suivi du focus) ; encre `--text-muted` à l'état disabled (règle du skill). */
const inputHeights = { sm: 'var(--control-h-sm)', md: 'var(--control-h-md)', lg: 'var(--control-h-lg)', xl: 'var(--control-h-xl)' };

export function Input({ icon, error, disabled, size = 'md', style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const h = inputHeights[size] || inputHeights.md;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      {icon && <span style={{ position: 'absolute', left: 12, display: 'flex', color: 'var(--text-muted)' }}><Icon name={icon} size="sm" /></span>}
      <input
        disabled={disabled}
        {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur && rest.onBlur(e); }}
        style={{
          width: '100%', height: h, padding: icon ? '0 12px 0 34px' : '0 12px',
          font: size === 'lg' || size === 'xl' ? 'var(--text-body-lg)' : 'var(--text-body)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
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
