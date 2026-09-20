// Nickname normalisation and shape validation (§4.6). Pure. No word filter: substring matching
// rejected ordinary first names (Dominique, Philippe…), so moderation is the presenter's kick.

import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from './constants.js';

/** Normalised uniqueness key: NFD, diacritics stripped, lowercase, whitespace collapsed. */
export function nicknameKey(nickname: string): string {
  return nickname
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type NicknameValidation =
  { ok: true; nickname: string; key: string } | { ok: false; code: 'NICKNAME_INVALID'; message: string };

const ALLOWED_CHARS = /^[\p{L}\p{N} \-_.']+$/u;

/** Validate shape only. Uniqueness (NICKNAME_TAKEN) is checked server-side per session. */
export function validateNickname(raw: string): NicknameValidation {
  // NFC first: a decomposed « é » (e + U+0301, as some keyboards and pastes produce) is a letter.
  const trimmed = raw.trim().normalize('NFC');
  if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      code: 'NICKNAME_INVALID',
      message: `Le pseudo doit contenir entre ${NICKNAME_MIN_LENGTH} et ${NICKNAME_MAX_LENGTH} caractères`,
    };
  }
  if (!ALLOWED_CHARS.test(trimmed)) {
    return {
      ok: false,
      code: 'NICKNAME_INVALID',
      message: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces, tirets et points',
    };
  }
  // Some pictographs are classed as letters (ℹ U+2139 is Ll), so \p{L} alone lets them through.
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return { ok: false, code: 'NICKNAME_INVALID', message: 'Le pseudo ne peut pas contenir d’emoji' };
  }
  return { ok: true, nickname: trimmed, key: nicknameKey(trimmed) };
}
