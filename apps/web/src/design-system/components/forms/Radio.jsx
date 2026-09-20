import React from 'react';

/* Patch lot 4 : prop `disabled` (groupe inerte : inputs `disabled`, pastille `--gray-100`, curseur
   `not-allowed`) et option `{ ariaLabel }` — une option sans libellé visible (la coche « bonne
   réponse » devant chaque proposition de l'éditeur) garde un nom accessible et ne rend pas de
   `<span>` vide. */
export function Radio({ options = [], value, onChange, name, direction = 'column', disabled, style, ...rest }) {
  return (
    <div role="radiogroup" aria-disabled={disabled || undefined} {...rest} style={{ display: 'flex', flexDirection: direction, gap: direction === 'row' ? 'var(--space-6)' : 'var(--space-4)', ...style }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const ariaLabel = typeof o === 'string' ? undefined : o.ariaLabel;
        const on = value === v;
        return (
          <label key={v} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <input type="radio" name={name} checked={on} disabled={disabled} aria-label={ariaLabel}
              onChange={() => onChange && onChange(v)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
            <span style={{
              width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid ' + (on && !disabled ? 'var(--brand-700)' : 'var(--border-default)'),
              background: disabled ? 'var(--gray-100)' : 'var(--surface-card)', transition: 'border-color var(--dur-fast) var(--ease-out)',
            }}>
              {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: disabled ? 'var(--gray-400)' : 'var(--surface-brand)' }} />}
            </span>
            {l ? <span style={{ font: 'var(--text-body)', color: disabled ? 'var(--text-muted)' : undefined }}>{l}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
