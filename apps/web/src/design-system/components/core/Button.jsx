import React from 'react';
import { Icon } from './Icon.tsx';

const buttonSizes = {
  sm: { height: 'var(--control-h-sm)', padding: '0 12px', font: 'var(--text-label)', radius: 'var(--radius-sm)', gap: 6, icon: 'sm' },
  md: { height: 'var(--control-h-md)', padding: '0 16px', font: 'var(--text-button)', radius: 'var(--radius-md)', gap: 8, icon: 'md' },
  lg: { height: 'var(--control-h-lg)', padding: '0 24px', font: '600 17px/1 var(--font-sans)', radius: 'var(--radius-md)', gap: 10, icon: 'md' },
  // Patch local (§ 4.2) : taille xl — pouce du participant et lecture depuis le fond de la salle.
  xl: { height: 'var(--control-h-xl)', padding: '0 var(--space-8)', font: '600 19px/1 var(--font-sans)', radius: 'var(--radius-md)', gap: 12, icon: 'lg' },
};

const buttonVariants = {
  primary: { background: 'var(--surface-brand)', color: 'var(--text-inverse)', border: '1px solid var(--brand-700)', hover: 'var(--brand-600)' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', hover: 'var(--gray-50)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent', hover: 'var(--gray-100)' },
  danger: { background: 'var(--state-danger)', color: 'var(--text-inverse)', border: '1px solid var(--state-danger)', hover: 'var(--red-700)' },
  inverse: { background: 'var(--stage-control)', color: 'var(--stage-ink)', border: '1px solid var(--stage-border-strong)', hover: 'var(--stage-control-hover)' },
};

/* Patch local (§ 4.2) : le spinner de l'état loading. Keyframe qiSpin dans styles.css. */
function Spinner({ px }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: px, height: px, flex: '0 0 auto', borderRadius: '50%',
        border: '2px solid currentColor', borderTopColor: 'transparent',
        animation: 'qiSpin .8s linear infinite',
      }}
    />
  );
}

export function Button({ variant = 'primary', size = 'md', icon, iconRight, block, loading, disabled, onClick, children, style, ...rest }) {
  const s = buttonSizes[size] || buttonSizes.md;
  const v = buttonVariants[variant] || buttonVariants.primary;
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const iconPx = { sm: 14, md: 18, lg: 22, xl: 28 }[s.icon] || 18;
  const inert = disabled || loading;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={loading ? true : undefined}
      onClick={loading ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
      style={{
        display: block ? 'flex' : 'inline-flex', width: block ? '100%' : undefined,
        alignItems: 'center', justifyContent: 'center', gap: s.gap,
        height: s.height, padding: s.padding, font: s.font, letterSpacing: '-0.005em',
        borderRadius: s.radius,
        /* Patch local (lot 3) : une seule déclaration de bordure. Le kit posait `border: v.border`
           puis `borderColor: disabled ? … : undefined` ; React sérialise `undefined` en chaîne
           vide, ce qui annulait la couleur du raccourci et faisait retomber la bordure sur
           `currentColor` — cadre visible sur tous les `ghost`, liseré blanc sur les `primary`. */
        border: disabled ? '1px solid var(--border-subtle)' : v.border,
        background: disabled ? 'var(--gray-100)' : hover && !loading ? v.hover : v.background,
        color: disabled ? 'var(--text-muted)' : v.color,
        boxShadow: press ? 'var(--shadow-inset-press)' : variant === 'ghost' || variant === 'inverse' ? 'none' : 'var(--shadow-1)',
        cursor: disabled ? 'not-allowed' : loading ? 'progress' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        transform: press && !inert ? 'translateY(1px)' : 'none',
        ...style,
      }}
    >
      {loading ? <Spinner px={iconPx} /> : icon && (typeof icon === 'string' ? <Icon name={icon} size={s.icon} /> : icon)}
      {children}
      {iconRight && (typeof iconRight === 'string' ? <Icon name={iconRight} size={s.icon} /> : iconRight)}
    </button>
  );
}
