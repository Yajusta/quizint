import React from 'react';

/* Patch lot 2 : tone=brand — code en --brand-700 sur le panneau blanc du QR (plan § 5.2 / § 7-7). */
export function JoinCode({ code = '482 913', label = 'Code de session', tone = 'dark', size = 'lg', style, ...rest }) {
  const dark = tone === 'dark';
  const ink = dark ? 'var(--stage-ink)' : tone === 'brand' ? 'var(--brand-700)' : 'var(--text-primary)';
  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start', ...style }}>
      <span style={{ font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
        color: dark ? 'var(--stage-ink-2)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{ font: 'var(--text-numeric-xl)', fontSize: size === 'lg' ? 72 : size === 'md' ? 40 : 26,
        letterSpacing: 'var(--tracking-code)', color: ink }}>{code}</span>
    </div>
  );
}
