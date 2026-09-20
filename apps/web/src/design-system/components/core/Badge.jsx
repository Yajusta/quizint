import React from 'react';
import { Icon } from './Icon.tsx';

const badgeTones = {
  neutral: { bg: 'var(--gray-100)', fg: 'var(--gray-700)', bd: 'var(--gray-200)' },
  brand: { bg: 'var(--brand-50)', fg: 'var(--brand-700)', bd: 'var(--brand-100)' },
  success: { bg: 'var(--state-success-soft)', fg: 'var(--state-success)', bd: 'var(--state-success-soft)' },
  warning: { bg: 'var(--state-warning-soft)', fg: 'var(--state-warning)', bd: 'var(--state-warning-soft)' },
  danger: { bg: 'var(--state-danger-soft)', fg: 'var(--state-danger)', bd: 'var(--state-danger-soft)' },
  live: { bg: 'var(--state-danger)', fg: 'var(--white)', bd: 'var(--state-danger)' },
};

export function Badge({ tone = 'neutral', icon, dot, children, style, ...rest }) {
  const t = badgeTones[tone] || badgeTones.neutral;
  return (
    <span {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px',
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, borderRadius: 'var(--radius-full)',
      font: 'var(--text-label)', whiteSpace: 'nowrap', ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
