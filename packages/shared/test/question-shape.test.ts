import { describe, expect, it } from 'vitest';

import { validateQuestionShape } from '../src/schemas/domain.js';

const trueFalse = (yes: string, no: string) => ({
  type: 'TRUE_FALSE' as const,
  choices: [
    { label: yes, isCorrect: true },
    { label: no, isCorrect: false },
  ],
  numericAnswer: null,
  pointsCorrect: 100,
  pointsWrong: 0,
  speedBonusMax: 0,
  timeLimitSec: null,
});

describe('validateQuestionShape — TRUE_FALSE labels', () => {
  it('accepts the French and the English pair, whatever the case, the spaces or the order', () => {
    expect(validateQuestionShape(trueFalse('Vrai', 'Faux'))).toEqual([]);
    expect(validateQuestionShape(trueFalse('True', 'False'))).toEqual([]);
    expect(validateQuestionShape(trueFalse(' FALSE ', 'true'))).toEqual([]);
  });

  it('refuses a pair mixing two languages, and any other wording', () => {
    expect(validateQuestionShape(trueFalse('Vrai', 'False'))).toHaveLength(1);
    expect(validateQuestionShape(trueFalse('Oui', 'Non'))).toHaveLength(1);
    expect(validateQuestionShape(trueFalse('True', 'True'))).toHaveLength(1);
  });
});
