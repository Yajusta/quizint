// Supported UI languages. The dictionaries live in `locales/<lng>/<ns>.ts` and are code-split:
// adding a language means adding a folder there and one entry in `SUPPORTED_LANGUAGES`.

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Fallback, and the language the app was written in. */
export const DEFAULT_LANGUAGE: Language = 'fr';

/** `localStorage` key holding the viewer's explicit choice (the detector reads and writes it). */
export const LANGUAGE_STORAGE_KEY = 'quiz.lang';

/** Endonyms — a language is always named in itself, never translated. */
export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** `fr-BE` → `fr`; anything unknown → the default. */
export function normalizeLanguage(value: string | undefined | null): Language {
  const base = value?.split('-')[0]?.toLowerCase();
  return isLanguage(base) ? base : DEFAULT_LANGUAGE;
}
