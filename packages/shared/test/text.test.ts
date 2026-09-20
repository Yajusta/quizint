import { describe, expect, it } from 'vitest';

import { TEXT_ANSWER_MAX_LENGTH } from '../src/constants.js';
import { AnswerPayload, AnswerSubmission, QuestionInput } from '../src/schemas/domain.js';
import { scoreAnswer } from '../src/scoring.js';
import { buildFinalStats, buildTextDistribution, correctAnswerFor } from '../src/stats.js';
import { normalizeTextAnswer, parseTextInput } from '../src/text.js';
import { FIXTURE_QUIZ_SHOWCASE } from './fixtures.js';

const textPoll = FIXTURE_QUIZ_SHOWCASE.questions.find((q) => q.type === 'TEXT_POLL')!;

describe('parseTextInput', () => {
  it('collapses whitespace and trims, keeping case and accents', () => {
    expect(parseTextInput('  Très \n\t bien  ')).toEqual({ ok: true, text: 'Très bien' });
  });
  it('refuses an empty or blank answer', () => {
    expect(parseTextInput('').ok).toBe(false);
    expect(parseTextInput(' \n ').ok).toBe(false);
  });
  it('bounds the length after collapsing', () => {
    expect(parseTextInput('a'.repeat(TEXT_ANSWER_MAX_LENGTH)).ok).toBe(true);
    expect(parseTextInput('a'.repeat(TEXT_ANSWER_MAX_LENGTH + 1))).toMatchObject({
      ok: false,
      code: 'INVALID_TEXT',
    });
    expect(parseTextInput(`${'a'.repeat(TEXT_ANSWER_MAX_LENGTH - 1)}     b`).ok).toBe(false);
    expect(parseTextInput(`a${' '.repeat(100)}b`)).toEqual({ ok: true, text: 'a b' });
  });
});

describe('normalizeTextAnswer', () => {
  it('upper-cases and strips accents', () => {
    expect(normalizeTextAnswer('Été à Noël')).toBe('ETE A NOEL');
    expect(normalizeTextAnswer('ça')).toBe('CA');
  });
  it('spells out the ligatures', () => {
    expect(normalizeTextAnswer('cœur')).toBe('COEUR');
    expect(normalizeTextAnswer('Ex æquo')).toBe('EX AEQUO');
  });
  it('strips punctuation at both ends only', () => {
    expect(normalizeTextAnswer('« Bien ! »')).toBe('BIEN');
    expect(normalizeTextAnswer('peut-être...')).toBe('PEUT-ETRE');
    expect(normalizeTextAnswer('C’est ok')).toBe("C'EST OK");
  });
  it('keeps a trailing + or # as part of the word', () => {
    expect(normalizeTextAnswer('c++')).toBe('C++');
    expect(normalizeTextAnswer('C# !')).toBe('C#');
    expect(normalizeTextAnswer('C')).toBe('C');
  });
  it('is empty for punctuation only', () => {
    expect(normalizeTextAnswer('?!')).toBe('');
    expect(normalizeTextAnswer('++')).toBe('');
  });
});

describe('buildTextDistribution', () => {
  it('groups by normalised form, most given first then alphabetical', () => {
    const entries = buildTextDistribution([
      { payload: { text: 'Lent' } },
      { payload: { text: 'rapide' } },
      { payload: { text: 'Rapide !' } },
      { payload: { text: 'Agile' } },
      { payload: { text: 'RAPIDE' } },
      { payload: { text: 'lent' } },
      { payload: { text: '...' } },
      { payload: { choiceId: '00000000-0000-4000-8000-000000000000' } },
    ]);
    expect(entries).toEqual([
      { text: 'RAPIDE', count: 3 },
      { text: 'LENT', count: 2 },
      { text: 'AGILE', count: 1 },
    ]);
  });
  it('is empty with no answers', () => {
    expect(buildTextDistribution([])).toEqual([]);
  });
});

describe('TEXT_POLL rules', () => {
  const base = {
    type: 'TEXT_POLL',
    prompt: 'Un mot ?',
    pointsCorrect: 0,
    pointsWrong: 0,
  };

  it('accepts a TEXT_POLL without choices nor points', () => {
    expect(QuestionInput.safeParse(base).success).toBe(true);
  });
  it('refuses choices, points, a speed bonus or a numeric answer', () => {
    expect(QuestionInput.safeParse({ ...base, choices: [{ label: 'A' }, { label: 'B' }] }).success).toBe(
      false,
    );
    expect(QuestionInput.safeParse({ ...base, pointsCorrect: 100 }).success).toBe(false);
    expect(QuestionInput.safeParse({ ...base, speedBonusMax: 10, timeLimitSec: 20 }).success).toBe(false);
    expect(
      QuestionInput.safeParse({
        ...base,
        numericAnswer: { value: 1, tolerance: 0, toleranceMode: 'ABSOLUTE' },
      }).success,
    ).toBe(false);
  });
  it('scores nothing and has no correct answer', () => {
    expect(scoreAnswer(textPoll, { text: 'Rapide' }, 100)).toEqual({
      isCorrect: null,
      pointsBase: 0,
      pointsBonus: 0,
      pointsAwarded: 0,
    });
    expect(correctAnswerFor(textPoll)).toBeNull();
  });
  it('takes no part in the best / worst question ratios', () => {
    const questions = [textPoll];
    const stats = buildFinalStats(
      questions,
      [{ questionIndex: 0, participantsAtClose: 2, answersCount: 2, correctCount: 0 }],
      [],
      [],
    );
    expect(stats.bestQuestion).toBeNull();
    expect(stats.worstQuestion).toBeNull();
  });
  it('accepts a text submission and a text payload', () => {
    expect(AnswerSubmission.parse({ text: 'Rapide' })).toEqual({ text: 'Rapide' });
    expect(AnswerPayload.parse({ text: 'Rapide' })).toEqual({ text: 'Rapide' });
  });
});
