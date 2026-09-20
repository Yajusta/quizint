import React from 'react';
import { Icon } from './Icon.jsx';

const iconButtonSizes = { sm: 32, md: 40, lg: 52 };

export function IconButton({ icon, label, variant = 'secondary', size = 'md', disabled, style, ...rest }) {
  const px = iconButtonSizes[size] || iconButtonSizes.md;
  const [hover, setHover] = React.useState(false);
  const tone = {
    secondary: { bg: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', hoverBg: 'var(--gray-50)' },
    ghost: { bg: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', hoverBg: 'var(--gray-100)' },
    primary: { bg: 'var(--surface-brand)', border: '1px solid var(--brand-700)', color: 'var(--text-inverse)', hoverBg: 'var(--brand-600)' },
    inverse: { bg: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.28)', color: 'var(--stage-ink)', hoverBg: 'rgba(255,255,255,.24)' },
  }[variant];
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        width: px, height: px, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-md)', border: tone.border,
        background: disabled ? 'var(--gray-100)' : hover ? tone.hoverBg : tone.bg,
        color: disabled ? 'var(--text-muted)' : tone.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out)',
        ...style,
      }}
    >
      <Icon name={icon} size={size === 'sm' ? 'sm' : 'md'} />
    </button>
  );
}
