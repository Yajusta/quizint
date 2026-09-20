import React from 'react';
import { Icon } from './Icon.jsx';

const buttonSizes = {
  sm: { height: 'var(--control-h-sm)', padding: '0 12px', font: 'var(--text-label)', radius: 'var(--radius-sm)', gap: 6, icon: 'sm' },
  md: { height: 'var(--control-h-md)', padding: '0 16px', font: 'var(--text-button)', radius: 'var(--radius-md)', gap: 8, icon: 'md' },
  lg: { height: 'var(--control-h-lg)', padding: '0 24px', font: '600 17px/1 var(--font-sans)', radius: 'var(--radius-md)', gap: 10, icon: 'md' },
};

const buttonVariants = {
  primary: { background: 'var(--surface-brand)', color: 'var(--text-inverse)', border: '1px solid var(--brand-700)', hover: 'var(--brand-600)' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', hover: 'var(--gray-50)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent', hover: 'var(--gray-100)' },
  danger: { background: 'var(--state-danger)', color: 'var(--text-inverse)', border: '1px solid var(--state-danger)', hover: '#A83126' },
  inverse: { background: 'rgba(255,255,255,.14)', color: 'var(--stage-ink)', border: '1px solid rgba(255,255,255,.28)', hover: 'rgba(255,255,255,.22)' },
};

export function Button({ variant = 'primary', size = 'md', icon, iconRight, block, disabled, children, style, ...rest }) {
  const s = buttonSizes[size] || buttonSizes.md;
  const v = buttonVariants[variant] || buttonVariants.primary;
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
      style={{
        display: block ? 'flex' : 'inline-flex', width: block ? '100%' : undefined,
        alignItems: 'center', justifyContent: 'center', gap: s.gap,
        height: s.height, padding: s.padding, font: s.font, letterSpacing: '-0.005em',
        borderRadius: s.radius, border: v.border,
        background: disabled ? 'var(--gray-100)' : hover ? v.hover : v.background,
        color: disabled ? 'var(--text-muted)' : v.color,
        borderColor: disabled ? 'var(--border-subtle)' : undefined,
        boxShadow: press ? 'var(--shadow-inset-press)' : variant === 'ghost' || variant === 'inverse' ? 'none' : 'var(--shadow-1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        transform: press && !disabled ? 'translateY(1px)' : 'none',
        ...style,
      }}
    >
      {icon && (typeof icon === 'string' ? <Icon name={icon} size={s.icon} /> : icon)}
      {children}
      {iconRight && (typeof iconRight === 'string' ? <Icon name={iconRight} size={s.icon} /> : iconRight)}
    </button>
  );
}
