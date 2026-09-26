// CSV injection guard (OWASP "CSV Injection"): pure functions, no database.

import { describe, expect, it } from 'vitest';

import { buildScoresCsv, csvCell, formulaSafe } from '../src/modules/sessions/csv.js';

describe('formulaSafe', () => {
  it.each([
    '=1+1',
    '+33 6 00 00 00 00',
    '-2+3',
    '@SUM(A1)',
    '\t=1',
    '\r=1',
    '\n=1',
    ' =HYPERLINK("http://x")',
    '   @cmd',
    '\u00A0=1', // no-break space
    '\u202F+1', // narrow no-break space
    '\u200B=1', // zero-width space
    '\uFEFF=1', // stray BOM
    '\u0000=1', // NUL
    '\u000B-1', // vertical tab
    '\uFF1D1+1', // full-width equals sign
    '\uFF20SUM(A1)', // full-width commercial at
    '\t',
  ])('prefixes %j with a quote', (value) => {
    expect(formulaSafe(value)).toBe(`'${value}`);
  });

  it.each(['Paris', 'Réponse = 42', 'a-b', "l'été", '', '   ', '42', 'x@y.fr'])(
    'leaves %j untouched',
    (value) => {
      expect(formulaSafe(value)).toBe(value);
    },
  );
});

describe('csvCell', () => {
  it('quotes separators of any locale, quotes and line breaks', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('a,=1+1')).toBe('"a,=1+1"');
    expect(csvCell('a\tb')).toBe('"a\tb"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\r\nl2')).toBe('"l1\r\nl2"');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
  });
});

describe('buildScoresCsv', () => {
  it('neutralises a nickname crafted as a formula behind leading blanks', () => {
    const csv = buildScoresCsv(
      [{ participantId: 'p1', nickname: ' =HYPERLINK("http://evil")', score: 10, rank: 1, isKicked: false }],
      new Map(),
    );
    const row = csv.replace(/^\uFEFF/, '').split('\r\n')[1]!;
    expect(row.split(';')[1]).toBe(`"' =HYPERLINK(""http://evil"")"`);
  });
});
