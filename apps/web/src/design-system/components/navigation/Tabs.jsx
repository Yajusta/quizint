import React from 'react';
import { Icon } from '../core/Icon.tsx';

/* Patchs locaux (lot 3) :
   - interligne identique actif/inactif (`600 15px/1.55` vs `400 15px/1.55`) : le kit passait de
     `600 15px/1` à `var(--text-body)` (1.55), si bien que le libellé sautait d'un pixel à la
     sélection et que les onglets ne partageaient pas la même ligne de base ;
   - prop `fill` : les boutons prennent toute la hauteur du conteneur, contenu centré
     verticalement, soulignement collé au bord bas — pour poser les onglets dans une barre haute
     sans caler l'alignement à la main côté page ;
   - compteur à 13 px (`--text-label`) au lieu de 12 : aucun texte sous 13 px (plan § 11.4-6).
   Patch lot 4 : prop `disabled` — le groupe entier est inerte (boutons `disabled`, encre
   `--text-muted`, curseur `not-allowed`), l'onglet actif reste souligné en gris pour dire l'état
   courant. Sert au sélecteur de type d'une question verrouillée (plan § 5.3). */
export function Tabs({ tabs = [], value, onChange, fill, disabled, style, ...rest }) {
  return (
    <div
      role="tablist"
      aria-disabled={disabled || undefined}
      {...rest}
      style={{
        display: 'flex',
        gap: 'var(--space-6)',
        borderBottom: '1px solid var(--border-subtle)',
        ...(fill ? { alignSelf: 'stretch', alignItems: 'stretch' } : {}),
        ...style,
      }}
    >
      {tabs.map((t) => {
        const v = typeof t === 'string' ? t : t.value;
        const l = typeof t === 'string' ? t : t.label;
        const on = value === v;
        return (
          <button key={v} type="button" role="tab" aria-selected={on} disabled={disabled} onClick={() => onChange && onChange(v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: fill ? '0' : '0 0 10px', height: fill ? '100%' : undefined, border: 0, background: 'transparent',
              font: on ? '600 15px/1.55 var(--font-sans)' : '400 15px/1.55 var(--font-sans)',
              color: disabled ? 'var(--text-muted)' : on ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: '2px solid ' + (on ? (disabled ? 'var(--gray-300)' : 'var(--brand-600)') : 'transparent'), marginBottom: -1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'color var(--dur-fast) var(--ease-out)' }}>
            {t.icon && <Icon name={t.icon} size="sm" />}{l}
            {t.count != null && <span style={{ font: 'var(--text-label)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
