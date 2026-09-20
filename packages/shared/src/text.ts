// Free-text answers of a TEXT_POLL: parsing and normalisation. Pure, no dependencies.

import { TEXT_ANSWER_MAX_LENGTH } from './constants.js';
import { ERROR_MESSAGES_FR } from './errors.js';

export type TextParseResult =
  { ok: true; text: string } | { ok: false; code: 'INVALID_TEXT'; message: string };

const INVALID: TextParseResult = { ok: false, code: 'INVALID_TEXT', message: ERROR_MESSAGES_FR.INVALID_TEXT };

/**
 * Accept a raw participant input: whitespace runs (line breaks included) collapse to one space,
 * then trim. Empty or longer than TEXT_ANSWER_MAX_LENGTH once collapsed is refused. The stored
 * answer keeps the participant's casing and accents: only the result screen normalises.
 */
export function parseTextInput(raw: string): TextParseResult {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > TEXT_ANSWER_MAX_LENGTH) return INVALID;
  return { ok: true, text };
}

// Letters NFD leaves whole: ligatures and a few stroked letters.
const LIGATURES: Record<string, string> = { Œ: 'OE', Æ: 'AE', Ø: 'O', Ł: 'L', Đ: 'D' };

/**
 * Key two answers are counted as the same under: upper case, no accent, whitespace collapsed,
 * punctuation stripped at both ends (« Bien ! » and « bien » count together). Inner punctuation
 * stays and curly apostrophes become straight (« C'EST », « PEUT-ÊTRE » → « PEUT-ETRE »).
 * A trailing « + » or « # » is part of the word (« C++ », « C# » and « C » are three answers).
 * May be empty (an answer made of punctuation only).
 */
export function normalizeTextAnswer(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[ŒÆØŁĐ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/[‘’ʼ]/g, "'") // mobile keyboards type a curly apostrophe
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, '');
}
