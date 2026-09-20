// Language picker. A native `Select` under the kit's chrome: it is the one control that already
// works everywhere (phone wheel, keyboard, screen reader) and stays right whatever the number of
// languages. Languages are named in themselves, so the list reads the same in any UI language.
//
// The choice is stored by the detector (`localStorage`), per viewer: a participant changing it does
// not touch anyone else's screen.

import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '../design-system/index.ts';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, useLanguage, type Language } from '../i18n/index.ts';

const DARK_STYLE = {
  background: 'var(--stage-panel)',
  color: 'var(--stage-ink)',
  borderColor: 'var(--stage-border-strong)',
} as const;

export interface LanguageSwitcherProps {
  /** `dark` on the stage ground, `light` on the app ground. */
  tone?: 'light' | 'dark';
  /** `sm` shrinks the control to the height of a top-bar button. */
  size?: 'sm' | 'md';
}

export function LanguageSwitcher({ tone = 'light', size = 'md' }: LanguageSwitcherProps) {
  const { t } = useTranslation('common');
  const { language, setLanguage } = useLanguage();
  const id = useId();

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: 'auto' }}>
      <label
        htmlFor={id}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {t('language.label')}
      </label>
      <Select
        id={id}
        value={language}
        aria-label={t('language.change')}
        onChange={(e) => setLanguage(e.target.value as Language)}
        options={SUPPORTED_LANGUAGES.map((lng) => ({ value: lng, label: LANGUAGE_LABELS[lng] }))}
        style={{
          width: 'auto',
          height: size === 'sm' ? 'var(--control-h-sm)' : 'var(--control-h-md)',
          font: 'var(--text-body-sm)',
          ...(tone === 'dark' ? DARK_STYLE : {}),
        }}
      />
    </div>
  );
}
