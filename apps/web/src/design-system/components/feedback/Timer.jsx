import React from 'react';

/* Patch local (§ 4.2 / écart § 7-3) : `tone` vaut `brand` par défaut — la couleur ne signifie
   que sélection ou correction, un anneau vert se lirait comme « bonne réponse ».
   brand = --brand-700 (app claire), inverse = --brand-300 (stage) ; bascule --state-danger < 5 s. */
export function Timer({ seconds = 20, total = 20, size = 'md', tone = 'brand', style, ...rest }) {
  const px = size === 'lg' ? 148 : size === 'sm' ? 56 : 96;
  const stroke = size === 'lg' ? 10 : size === 'sm' ? 5 : 7;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const dark = tone === 'inverse';
  const color = seconds <= 5 ? 'var(--state-danger)' : dark ? 'var(--brand-300)' : 'var(--brand-700)';
  const track = dark ? 'var(--stage-border)' : 'var(--gray-200)';
  return (
    <div role="timer" aria-label={`${seconds} secondes restantes`} {...rest} style={{ position: 'relative', width: px, height: px, ...style }}>
      <svg width={px} height={px} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke var(--dur-slow) var(--ease-out)' }} />
      </svg>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: 'var(--text-numeric)', fontSize: size === 'lg' ? 44 : size === 'sm' ? 16 : 28, color: 'inherit' }}>{seconds}</span>
    </div>
  );
}
