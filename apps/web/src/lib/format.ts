// Locale-aware number and typography formatting shared by the live surfaces (participant, stage,
// admin). Replaces the former `format-fr.ts`: same shapes, the active language decides.
//
// These are plain functions, not hooks: they read the language off the i18next instance. Every
// screen that shows a formatted number also shows translated text, so `useTranslation()` already
// re-renders it on `languageChanged` — no separate subscription is needed.

import i18next from 'i18next';

import { normalizeLanguage, type Language } from '../i18n/languages.ts';

/** Non-breaking space — FR typography before `? ! : ;` and between a number and its unit. */
export const NBSP = ' ';
/** True minus sign, U+2212 — always as text, never as an icon. */
export const MINUS = '−';

export function activeLanguage(): Language {
  return normalizeLanguage(i18next.resolvedLanguage ?? i18next.language);
}

const numberFormats = new Map<Language, Intl.NumberFormat>();

function numberFormat(lng: Language): Intl.NumberFormat {
  let fmt = numberFormats.get(lng);
  if (!fmt) {
    fmt = new Intl.NumberFormat(lng, { maximumFractionDigits: 2 });
    numberFormats.set(lng, fmt);
  }
  return fmt;
}

/** `1 234,5` in FR, `1,234.5` in EN — decimals only when needed, at most two. */
export function formatNumber(n: number): string {
  return numberFormat(activeLanguage()).format(n);
}

/**
 * Space before `? ! : ;` and `%`: a non-breaking space in FR, nothing in EN.
 * Translated strings carry their own spacing; this is for values composed in JSX.
 */
export function punctuationSpace(): string {
  return activeLanguage() === 'fr' ? NBSP : '';
}

const ORDINAL_SUFFIXES: Record<Language, Partial<Record<Intl.LDMLPluralRule, string>>> = {
  fr: { one: 'er', other: 'e' },
  en: { one: 'st', two: 'nd', few: 'rd', other: 'th' },
};

/** Ordinal suffix alone, for a superscript next to a large mono rank: `er`/`e`, `st`/`nd`/`rd`/`th`. */
export function ordinalSuffix(n: number): string {
  const lng = activeLanguage();
  const suffixes = ORDINAL_SUFFIXES[lng];
  const rule = new Intl.PluralRules(lng, { type: 'ordinal' }).select(n);
  return suffixes[rule] ?? suffixes.other ?? '';
}

/** `1er`, `2e`… / `1st`, `2nd`… (text form; the screens render the suffix as a superscript). */
export function ordinal(n: number): string {
  return `${formatNumber(n)}${ordinalSuffix(n)}`;
}

/**
 * A score as text: `1 234`, `−75`. Unlike a delta, a positive score carries no sign — but a
 * negative one must show the real minus U+2212, which `Intl.NumberFormat` never produces.
 *
 * No space after the sign here, unlike `formatDelta`: a score is read as one number, and in the
 * tabular mono of the podium a non-breaking space takes a full digit slot.
 */
export function formatScore(n: number): string {
  return n < 0 ? `${MINUS}${formatNumber(-n)}` : formatNumber(n);
}

/** Signed delta as text: `+ 940`, `− 25`, `0` unsigned. */
export function formatDelta(n: number): string {
  if (n > 0) return `+${NBSP}${formatNumber(n)}`;
  if (n < 0) return `${MINUS}${NBSP}${formatNumber(Math.abs(n))}`;
  return '0';
}

export function formatTolerance(ca: { tolerance: number; toleranceMode: 'ABSOLUTE' | 'PERCENT' }): string {
  return ca.toleranceMode === 'PERCENT' ? formatPercent(ca.tolerance) : formatNumber(ca.tolerance);
}

/** `12 %` in FR, `12%` in EN. */
export function formatPercent(n: number): string {
  return `${formatNumber(n)}${punctuationSpace()}%`;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(lng: Language, options: Intl.DateTimeFormatOptions, tag: string): Intl.DateTimeFormat {
  const cacheKey = `${lng}:${tag}`;
  let fmt = dateFormats.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(lng, options);
    dateFormats.set(cacheKey, fmt);
  }
  return fmt;
}

/** Full date of a timestamp: `12/09/2026` in FR, `09/12/2026` in EN. */
export function formatDate(ms: number): string {
  return dateFormat(activeLanguage(), {}, 'full').format(ms);
}

/** Day and month only, for a subtitle: `12/09`. */
export function formatShortDate(ms: number): string {
  return dateFormat(activeLanguage(), { day: '2-digit', month: '2-digit' }, 'short').format(ms);
}
