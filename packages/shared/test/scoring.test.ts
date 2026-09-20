import { describe, expect, it } from 'vitest';

import { FIXTURE_QUIZ_SNAPSHOT } from './fixtures.js';
import { scoreAnswer } from '../src/scoring.js';
import type { SnapshotQuestion } from '../src/schemas/domain.js';

const [mcq, numeric, trueFalse, poll] = FIXTURE_QUIZ_SNAPSHOT.questions as [
  SnapshotQuestion,
  SnapshotQuestion,
  SnapshotQuestion,
  SnapshotQuestion,
];

describe('scoreAnswer — POLL', () => {
  it('awards nothing and reports null correctness', () => {
    const r = scoreAnswer(poll, { choiceId: poll.choices[0]!.id }, 1000);
    expect(r).toEqual({ isCorrect: null, pointsBase: 0, pointsBonus: 0, pointsAwarded: 0 });
  });
});

describe('scoreAnswer — MCQ with malus', () => {
  it('awards base points on a correct answer without timer context', () => {
    // mcq has timeLimitSec 20 and speedBonusMax 50
    const correctChoice = mcq.choices.find((c) => c.isCorrect)!;
    const r = scoreAnswer(mcq, { choiceId: correctChoice.id }, 0);
    expect(r.isCorrect).toBe(true);
    expect(r.pointsBase).toBe(100);
    expect(r.pointsBonus).toBe(50); // ratio 1 at elapsed 0
    expect(r.pointsAwarded).toBe(150);
  });
  it('applies the documented example: 100 pts + bonus 50, timer 20 s, answer at 5 s', () => {
    const correctChoice = mcq.choices.find((c) => c.isCorrect)!;
    const r = scoreAnswer(mcq, { choiceId: correctChoice.id }, 5000);
    // ratio = 1 - 5000/20000 = 0.75 → bonus = round(50 × 0.75) = 38
    expect(r.pointsBonus).toBe(38);
    expect(r.pointsAwarded).toBe(138);
  });
  it('gives zero bonus when answering exactly at the deadline', () => {
    const correctChoice = mcq.choices.find((c) => c.isCorrect)!;
    const r = scoreAnswer(mcq, { choiceId: correctChoice.id }, 20000);
    expect(r.pointsBonus).toBe(0);
    expect(r.pointsAwarded).toBe(100);
  });
  it('clamps the ratio at 0 when answering after the deadline', () => {
    const correctChoice = mcq.choices.find((c) => c.isCorrect)!;
    const r = scoreAnswer(mcq, { choiceId: correctChoice.id }, 99999);
    expect(r.pointsBonus).toBe(0);
  });
  it('applies a negative malus on a wrong answer, no bonus', () => {
    const wrong = mcq.choices.find((c) => !c.isCorrect)!;
    const r = scoreAnswer(mcq, { choiceId: wrong.id }, 100);
    expect(r).toEqual({ isCorrect: false, pointsBase: -25, pointsBonus: 0, pointsAwarded: -25 });
  });
  it('marks an unknown choice as incorrect', () => {
    const r = scoreAnswer(mcq, { choiceId: '00000000-0000-4000-8000-ffffffffffff' }, 100);
    expect(r.isCorrect).toBe(false);
  });
  it('marks a numeric payload on an MCQ as incorrect', () => {
    const r = scoreAnswer(mcq, { value: 3 }, 100);
    expect(r.isCorrect).toBe(false);
  });
});

describe('scoreAnswer — NUMERIC', () => {
  it('awards points on an exact match', () => {
    const r = scoreAnswer(numeric, { value: 8 }, 1000);
    expect(r.isCorrect).toBe(true);
    expect(r.pointsBase).toBe(50);
  });
  it('rejects an off value (tolerance 0)', () => {
    const r = scoreAnswer(numeric, { value: 7.9 }, 1000);
    expect(r.isCorrect).toBe(false);
  });
  it('applies tolerance', () => {
    const last = FIXTURE_QUIZ_SNAPSHOT.questions[5]!; // 3.5 ± 0.1
    expect(scoreAnswer(last, { value: 3.6 }, 0).isCorrect).toBe(true);
    expect(scoreAnswer(last, { value: 3.61 }, 0).isCorrect).toBe(false);
  });
  it('marks a choice payload on a numeric question as incorrect', () => {
    const r = scoreAnswer(numeric, { choiceId: '00000000-0000-4000-8000-aaaaaaaaaaaa' }, 100);
    expect(r.isCorrect).toBe(false);
  });
});

describe('scoreAnswer — TRUE_FALSE', () => {
  it('scores the correct label', () => {
    const faux = trueFalse.choices.find((c) => c.label === 'Faux')!;
    const r = scoreAnswer(trueFalse, { choiceId: faux.id }, 0);
    expect(r.isCorrect).toBe(true);
    expect(r.pointsBase).toBe(100);
    expect(r.pointsBonus).toBe(0); // no timer
  });
  it('applies the malus on Vrai', () => {
    const vrai = trueFalse.choices.find((c) => c.label === 'Vrai')!;
    const r = scoreAnswer(trueFalse, { choiceId: vrai.id }, 0);
    expect(r.pointsAwarded).toBe(-25);
  });
});
