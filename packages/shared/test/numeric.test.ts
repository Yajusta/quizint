import { describe, expect, it } from 'vitest';

import { matchesNumeric, parseNumericInput } from '../src/numeric.js';

describe('parseNumericInput', () => {
  it('accepts plain integers', () => {
    expect(parseNumericInput('42')).toEqual({ ok: true, value: 42 });
  });
  it('accepts decimals with a comma', () => {
    expect(parseNumericInput('3,5')).toEqual({ ok: true, value: 3.5 });
  });
  it('accepts decimals with a dot', () => {
    expect(parseNumericInput('3.5')).toEqual({ ok: true, value: 3.5 });
  });
  it('accepts a leading minus', () => {
    expect(parseNumericInput('-12')).toEqual({ ok: true, value: -12 });
  });
  it('accepts the dashes a mobile keyboard may substitute for the minus', () => {
    expect(parseNumericInput('–3')).toEqual({ ok: true, value: -3 });
    expect(parseNumericInput('—0,5')).toEqual({ ok: true, value: -0.5 });
  });
  it('accepts the true minus U+2212', () => {
    expect(parseNumericInput('−7,25')).toEqual({ ok: true, value: -7.25 });
  });
  it('trims surrounding whitespace', () => {
    expect(parseNumericInput('  8 ')).toEqual({ ok: true, value: 8 });
  });
  it('rejects internal spaces', () => {
    expect(parseNumericInput('3 500').ok).toBe(false);
  });
  it('rejects the empty string', () => {
    expect(parseNumericInput('').ok).toBe(false);
  });
  it('rejects two separators', () => {
    expect(parseNumericInput('3,5.2').ok).toBe(false);
  });
  it('rejects scientific notation', () => {
    expect(parseNumericInput('1e3').ok).toBe(false);
  });
  it('rejects percent', () => {
    expect(parseNumericInput('50%').ok).toBe(false);
  });
  it('rejects units', () => {
    expect(parseNumericInput('12kg').ok).toBe(false);
  });
  it('rejects letters', () => {
    expect(parseNumericInput('abc').ok).toBe(false);
  });
  it('rejects a lone separator', () => {
    expect(parseNumericInput(',').ok).toBe(false);
  });
  it('rejects a trailing separator', () => {
    expect(parseNumericInput('3.').ok).toBe(false);
  });
});

describe('matchesNumeric', () => {
  const abs = { value: 42, tolerance: 0, toleranceMode: 'ABSOLUTE' as const };
  it('matches exactly', () => {
    expect(matchesNumeric(42, abs)).toBe(true);
  });
  it('rejects off values without tolerance', () => {
    expect(matchesNumeric(42.1, abs)).toBe(false);
  });
  it('applies absolute tolerance', () => {
    const spec = { value: 42, tolerance: 2, toleranceMode: 'ABSOLUTE' as const };
    expect(matchesNumeric(43.9999, spec)).toBe(true);
    expect(matchesNumeric(44.0001, spec)).toBe(false);
    expect(matchesNumeric(40, spec)).toBe(true);
    expect(matchesNumeric(39.9999, spec)).toBe(false);
  });
  it('applies percent tolerance', () => {
    const spec = { value: 200, tolerance: 5, toleranceMode: 'PERCENT' as const };
    expect(matchesNumeric(209, spec)).toBe(true); // |200-209|=9 <= 10
    expect(matchesNumeric(211, spec)).toBe(false); // 11 > 10
  });
  it('uses |value| as the percent base (negative expected)', () => {
    const spec = { value: -200, tolerance: 5, toleranceMode: 'PERCENT' as const };
    expect(matchesNumeric(-209, spec)).toBe(true);
    expect(matchesNumeric(-211, spec)).toBe(false);
  });
  it('absorbs float errors with epsilon', () => {
    const spec = { value: 0.3, tolerance: 0, toleranceMode: 'ABSOLUTE' as const };
    expect(matchesNumeric(0.1 + 0.2, spec)).toBe(true);
  });
});
