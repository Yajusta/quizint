import React from 'react';

export function ProgressBar({ value = 0, max = 100, tone = 'brand', size = 'md', label, style, ...rest }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const h = size === 'sm' ? 4 : size === 'lg' ? 12 : 8;
  const fill = { brand: 'var(--surface-brand)', success: 'var(--state-success)', warning: 'var(--state-warning)', danger: 'var(--state-danger)', inverse: 'var(--brand-300)' }[tone];
  return (
    <div {...rest} style={style}>
      {label && <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-label)', color: 'var(--text-secondary)', marginBottom: 6 }}>
        <span>{label}</span><span style={{ font: 'var(--text-numeric)', fontSize: 13 }}>{Math.round(pct)}%</span>
      </div>}
      <div style={{ height: h, borderRadius: 'var(--radius-full)', background: tone === 'inverse' ? 'var(--stage-border-2)' : 'var(--gray-200)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: fill, borderRadius: 'var(--radius-full)',
          transition: 'width var(--dur-slow) var(--ease-out)' }} />
      </div>
    </div>
  );
}
