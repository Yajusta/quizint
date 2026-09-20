// Active language + the setter the switcher calls. The value is always one of `SUPPORTED_LANGUAGES`,
// never a regional tag, so callers can index `LANGUAGE_LABELS` with it.

import { useTranslation } from 'react-i18next';

import { normalizeLanguage, type Language } from './languages.ts';

export interface UseLanguage {
  language: Language;
  setLanguage: (next: Language) => void;
}

export function useLanguage(): UseLanguage {
  const { i18n } = useTranslation();
  return {
    language: normalizeLanguage(i18n.resolvedLanguage ?? i18n.language),
    setLanguage: (next) => {
      void i18n.changeLanguage(next);
    },
  };
}
