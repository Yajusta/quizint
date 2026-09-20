import React from 'react';

export function JoinCode({ code = '482 913', label = 'Code de session', tone = 'dark', size = 'lg', style }) {
  const dark = tone === 'dark';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start', ...style }}>
      <span style={{ font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
        color: dark ? 'rgba(239,234,246,.66)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{ font: 'var(--text-numeric-xl)', fontSize: size === 'lg' ? 72 : size === 'md' ? 40 : 26,
        letterSpacing: 'var(--tracking-code)', color: dark ? 'var(--stage-ink)' : 'var(--text-primary)' }}>{code}</span>
    </div>
  );
}
