// i18next bootstrap. Imported once from `main.tsx`, before the app renders.
//
// Resources are NOT bundled: `resourcesToBackend` dynamic-imports `locales/<lng>/<ns>.ts`, so Vite
// emits one chunk per (language, namespace). A participant phone downloads `fr/common` +
// `fr/participant` and never the presenter or admin dictionaries. Components suspend while their
// namespace loads — `App`'s route-level `<Suspense>` already covers that.

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from './languages.ts';

/** One namespace per surface, plus what they share. Keeps each chunk to what a screen needs. */
export const NAMESPACES = ['common', 'participant', 'presenter', 'admin'] as const;

export const i18n = i18next
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.ts`),
    ),
  )
  .use(initReactI18next);

/** `<html lang>` follows the UI: screen readers, hyphenation and `:lang()` all depend on it. */
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = normalizeLanguage(lng);
});

export const i18nReady = i18n.init({
  supportedLngs: SUPPORTED_LANGUAGES,
  fallbackLng: DEFAULT_LANGUAGE,
  // `fr-BE` resolves to the `fr` dictionary: we ship no regional variants.
  load: 'languageOnly',
  ns: ['common'],
  defaultNS: 'common',
  detection: {
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    caches: ['localStorage'],
  },
  // React escapes for us; escaping twice would turn « l’écran » into an entity soup.
  interpolation: { escapeValue: false },
  react: { useSuspense: true },
});

export { DEFAULT_LANGUAGE, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from './languages.ts';
export type { Language } from './languages.ts';
export { useLanguage } from './useLanguage.ts';
