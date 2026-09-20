// Parsing / normalisation of numeric answers (§4.2). Pure, no dependencies.

import { NUMERIC_EPSILON } from './constants.js';
import { ERROR_MESSAGES_FR } from './errors.js';

export type NumericParseResult =
  { ok: true; value: number } | { ok: false; code: 'INVALID_NUMBER'; message: string };

const INVALID: NumericParseResult = {
  ok: false,
  code: 'INVALID_NUMBER',
  message: ERROR_MESSAGES_FR.INVALID_NUMBER,
};

/**
 * Parse a raw participant input string into a finite number.
 * Rules (§4.2): trim, no internal spaces, comma → dot (one separator only),
 * leading `-`, `−` (U+2212) or a dash `–`/`—` some mobile keyboards substitute for it,
 * shape ^-?\d+(\.\d+)?$, reject Infinity/NaN.
 */
export function parseNumericInput(raw: string): NumericParseResult {
  const s = raw.trim();
  if (s.length === 0 || /\s/.test(s)) return INVALID;
  // Normalise the true minus, the dashes and the comma separator.
  const normalised = s.replace(/^[−–—]/, '-').replace(',', '.');
  if (!/^[-]?\d+(\.\d+)?$/.test(normalised)) {
    return INVALID;
  }
  const value = Number(normalised);
  if (!Number.isFinite(value)) {
    return INVALID;
  }
  return { ok: true, value };
}

export interface NumericToleranceSpec {
  value: number;
  tolerance: number;
  toleranceMode: 'ABSOLUTE' | 'PERCENT';
}

/** Accepted closed interval for a numeric answer, before the epsilon guard. */
export function toleranceBounds(spec: NumericToleranceSpec): { lo: number; hi: number } {
  const limit =
    spec.toleranceMode === 'ABSOLUTE' ? spec.tolerance : Math.abs(spec.value) * (spec.tolerance / 100);
  return { lo: spec.value - limit, hi: spec.value + limit };
}

/** Check whether a submitted value matches the expected spec within tolerance (epsilon-guarded). */
export function matchesNumeric(value: number, spec: NumericToleranceSpec): boolean {
  const { lo, hi } = toleranceBounds(spec);
  return value >= lo - NUMERIC_EPSILON && value <= hi + NUMERIC_EPSILON;
}
