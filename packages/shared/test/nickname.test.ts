import { describe, expect, it } from 'vitest';

import { nicknameKey, validateNickname } from '../src/nickname.js';

describe('nicknameKey', () => {
  it('strips accents and lowercases', () => {
    expect(nicknameKey('Éric')).toBe('eric');
  });
  it('collapses repeated whitespace', () => {
    expect(nicknameKey('Jean   Luc')).toBe('jean luc');
  });
  it('collides Éric with eric', () => {
    expect(nicknameKey('Éric')).toBe(nicknameKey('eric'));
  });
});

describe('validateNickname', () => {
  it('accepts a normal nickname', () => {
    const r = validateNickname('Marie');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nickname).toBe('Marie');
      expect(r.key).toBe('marie');
    }
  });
  it('accepts letters, digits, spaces, hyphens, dots and apostrophes', () => {
    expect(validateNickname("Jean-Luc D'Argent.v2").ok).toBe(true);
  });
  it('trims before validating', () => {
    const r = validateNickname('  Yanis  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nickname).toBe('Yanis');
  });
  it('accepts a decomposed accent and stores it composed', () => {
    const r = validateNickname('Amélie');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nickname).toBe('Amélie');
  });
  it('rejects too short', () => {
    expect(validateNickname('A').ok).toBe(false);
  });
  it('rejects too long', () => {
    expect(validateNickname('a'.repeat(21)).ok).toBe(false);
  });
  it('rejects emoji', () => {
    const r = validateNickname('Marie 🎉');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NICKNAME_INVALID');
  });
  it('rejects pictographs that Unicode classes as letters', () => {
    const r = validateNickname('Tom ℹ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NICKNAME_INVALID');
  });
  it('rejects symbols', () => {
    expect(validateNickname('Marie!').ok).toBe(false);
  });
  it('has no word filter: first names that contain rude substrings are accepted', () => {
    for (const name of ['Dominique', 'Philippe', 'Jasmine', 'Violette', 'Grace', 'Hercule', 'Salem']) {
      expect(validateNickname(name).ok).toBe(true);
    }
    // Moderation is the presenter's kick, not a list.
    expect(validateNickname('GrandNazi').ok).toBe(true);
  });
});
