import React from 'react';

export function Timer({ seconds = 20, total = 20, size = 'md', tone = 'auto', style }) {
  const px = size === 'lg' ? 148 : size === 'sm' ? 56 : 96;
  const stroke = size === 'lg' ? 10 : size === 'sm' ? 5 : 7;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const color = tone === 'auto' ? (frac > 0.5 ? 'var(--state-success)' : frac > 0.2 ? 'var(--state-warning)' : 'var(--state-danger)')
    : tone === 'brand' ? 'var(--brand-500)' : 'var(--stage-ink)';
  return (
    <div style={{ position: 'relative', width: px, height: px, ...style }}>
      <svg width={px} height={px} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth={stroke} />
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke var(--dur-slow) var(--ease-out)' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: 'var(--text-numeric)', fontSize: size === 'lg' ? 44 : size === 'sm' ? 16 : 28, color: 'inherit' }}>{seconds}</span>
    </div>
  );
}
