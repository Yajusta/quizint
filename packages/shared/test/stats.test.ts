import { describe, expect, it } from 'vitest';

import { FIXTURE_QUIZ_SNAPSHOT } from './fixtures.js';
import {
  answerStatsByParticipant,
  buildChoiceDistribution,
  buildFinalStats,
  buildNumericDistribution,
  buildQuestionDistribution,
  buildRanking,
  correctAnswerFor,
  podiumFrom,
  type StatsAnswer,
  type StatsParticipant,
} from '../src/stats.js';

describe('buildQuestionDistribution', () => {
  const [mcq, numeric] = FIXTURE_QUIZ_SNAPSHOT.questions;

  it('counts the choices of a choice question', () => {
    const dist = buildQuestionDistribution(mcq!, [{ payload: { choiceId: mcq!.choices[1]!.id } }], 1);
    expect(dist.kind).toBe('CHOICES');
    expect(dist.kind === 'CHOICES' && dist.entries.map((e) => e.count)).toEqual([0, 1, 0]);
  });

  it('carries the expected value and the correct count of a numeric question', () => {
    expect(buildQuestionDistribution(numeric!, [{ payload: { value: 8 } }], 1)).toMatchObject({
      kind: 'NUMERIC',
      median: 8,
      expected: 8,
      correctCount: 1,
    });
    // Nobody answered: no buckets, no median.
    expect(buildQuestionDistribution(numeric!, [], 0)).toEqual({
      kind: 'NUMERIC',
      buckets: [],
      median: null,
      expected: 8,
      correctCount: 0,
    });
  });

  it('groups the answers of a free-text poll', () => {
    const textPoll = { ...mcq!, type: 'TEXT_POLL' as const, choices: [] };
    expect(
      buildQuestionDistribution(textPoll, [{ payload: { text: 'été' } }, { payload: { text: 'ETE' } }], 0),
    ).toEqual({ kind: 'TEXT', entries: [{ text: 'ETE', count: 2 }] });
  });
});

const participants: StatsParticipant[] = [
  { participantId: 'p1', nickname: 'Marie', score: 250, isKicked: false, joinedAt: 3 },
  { participantId: 'p2', nickname: 'Karim', score: 250, isKicked: false, joinedAt: 1 },
  { participantId: 'p3', nickname: 'Éric', score: 100, isKicked: false, joinedAt: 2 },
  { participantId: 'p4', nickname: 'Louise', score: 50, isKicked: true, joinedAt: 4 },
  { participantId: 'p5', nickname: 'Yanis', score: -25, isKicked: false, joinedAt: 5 },
];

const answers: StatsAnswer[] = [
  {
    participantId: 'p1',
    questionIndex: 0,
    payload: { choiceId: 'c1' },
    isCorrect: true,
    pointsAwarded: 150,
    elapsedMs: 5000,
  },
  {
    participantId: 'p2',
    questionIndex: 0,
    payload: { choiceId: 'c1' },
    isCorrect: true,
    pointsAwarded: 100,
    elapsedMs: 18000,
  },
  {
    participantId: 'p3',
    questionIndex: 0,
    payload: { choiceId: 'c2' },
    isCorrect: false,
    pointsAwarded: 0,
    elapsedMs: 9000,
  },
  {
    participantId: 'p1',
    questionIndex: 1,
    payload: { value: 8 },
    isCorrect: true,
    pointsAwarded: 100,
    elapsedMs: 2000,
  },
  {
    participantId: 'p4',
    questionIndex: 1,
    payload: { value: 8 },
    isCorrect: true,
    pointsAwarded: 100,
    elapsedMs: 3000,
  },
];

describe('buildRanking', () => {
  it('sorts by score desc', () => {
    const ranking = buildRanking(participants, answers);
    expect(ranking.map((r) => r.nickname)).toEqual(['Marie', 'Karim', 'Éric', 'Yanis']);
  });
  it('breaks score ties by fastest correct total, then joinedAt', () => {
    const ranking = buildRanking(participants, answers);
    // Marie and Karim both 250; Marie answered faster → first.
    expect(ranking[0]?.nickname).toBe('Marie');
    expect(ranking[1]?.nickname).toBe('Karim');
  });
  it('excludes kicked participants', () => {
    const ranking = buildRanking(participants, answers);
    expect(ranking.some((r) => r.nickname === 'Louise')).toBe(false);
  });
  it('assigns dense ranks with ex æquo only on strict equality', () => {
    const ranking = buildRanking(participants, answers);
    expect(ranking.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
  it('handles negative scores correctly', () => {
    const ranking = buildRanking(participants, answers);
    expect(ranking[ranking.length - 1]?.score).toBe(-25);
  });
});

describe('podiumFrom', () => {
  it('returns the top 3', () => {
    const podium = podiumFrom(buildRanking(participants, answers));
    expect(podium.map((p) => p.nickname)).toEqual(['Marie', 'Karim', 'Éric']);
  });
});

describe('buildChoiceDistribution', () => {
  it('counts per choice', () => {
    const q = FIXTURE_QUIZ_SNAPSHOT.questions[0]!;
    const entries = buildChoiceDistribution(q, [
      { payload: { choiceId: q.choices[0]!.id } },
      { payload: { choiceId: q.choices[1]!.id } },
      { payload: { choiceId: q.choices[1]!.id } },
      { payload: { choiceId: 'unknown' } },
    ]);
    expect(entries.map((e) => e.count)).toEqual([1, 2, 0]);
  });
});

describe('buildNumericDistribution', () => {
  it('buckets values', () => {
    const dist = buildNumericDistribution([
      { payload: { value: 1 } },
      { payload: { value: 2 } },
      { payload: { value: 2.5 } },
      { payload: { value: 10 } },
    ]);
    expect(dist).not.toBeNull();
    expect(dist?.min).toBe(1);
    expect(dist?.max).toBe(10);
    expect(dist?.buckets.reduce((s, b) => s + b.count, 0)).toBe(4);
  });
  it('computes the median', () => {
    const dist = buildNumericDistribution([
      { payload: { value: 1 } },
      { payload: { value: 3 } },
      { payload: { value: 10 } },
    ]);
    expect(dist?.median).toBe(3);
  });
  it('returns null with no values', () => {
    expect(buildNumericDistribution([])).toBeNull();
  });
});

describe('buildFinalStats', () => {
  const questions = FIXTURE_QUIZ_SNAPSHOT.questions;
  const results = [
    { questionIndex: 0, participantsAtClose: 4, answersCount: 3, correctCount: 1 },
    { questionIndex: 1, participantsAtClose: 4, answersCount: 2, correctCount: 2 },
    { questionIndex: 3, participantsAtClose: 4, answersCount: 4, correctCount: 0 }, // POLL
  ];
  it('computes best and worst graded questions', () => {
    const stats = buildFinalStats(questions, results, answers, participants);
    expect(stats.bestQuestion?.questionIndex).toBe(1); // 2/4 = 0.5
    expect(stats.worstQuestion?.questionIndex).toBe(0); // 1/4 = 0.25
    expect(stats.bestQuestion?.ratio).toBeCloseTo(0.5, 5);
  });
  it('finds the fastest correct answer', () => {
    const stats = buildFinalStats(questions, results, answers, participants);
    expect(stats.fastestCorrect?.nickname).toBe('Marie');
    expect(stats.fastestCorrect?.elapsedMs).toBe(2000);
  });
  it('counts participants', () => {
    const stats = buildFinalStats(questions, results, answers, participants);
    expect(stats.activeParticipants).toBe(3); // p1, p2, p3 (p4 kicked, p5 absent)
    expect(stats.totalParticipants).toBe(4); // non-kicked
  });
  it('averages the participation rate over all questions', () => {
    const stats = buildFinalStats(questions, results, answers, participants);
    // (3/4 + 2/4 + 4/4) / 3
    expect(stats.averageParticipationRate).toBeCloseTo((0.75 + 0.5 + 1) / 3, 5);
  });
});

describe('correctAnswerFor', () => {
  it('reveals the MCQ choice', () => {
    const ca = correctAnswerFor(FIXTURE_QUIZ_SNAPSHOT.questions[0]!);
    expect(ca).toMatchObject({ choiceId: expect.any(String), label: 'Parquet' });
  });
  it('reveals the numeric spec', () => {
    expect(correctAnswerFor(FIXTURE_QUIZ_SNAPSHOT.questions[1]!)).toEqual({
      value: 8,
      tolerance: 0,
      toleranceMode: 'ABSOLUTE',
    });
  });
  it('returns null for POLL', () => {
    expect(correctAnswerFor(FIXTURE_QUIZ_SNAPSHOT.questions[3]!)).toBeNull();
  });
});

describe('answerStatsByParticipant', () => {
  it('counts given and correct answers and sums the correct elapsed time in one pass', () => {
    const answers: StatsAnswer[] = [
      {
        participantId: 'a',
        questionIndex: 0,
        payload: { choiceId: 'x' },
        isCorrect: true,
        pointsAwarded: 100,
        elapsedMs: 800,
      },
      {
        participantId: 'a',
        questionIndex: 1,
        payload: { choiceId: 'x' },
        isCorrect: false,
        pointsAwarded: 0,
        elapsedMs: 300,
      },
      {
        participantId: 'a',
        questionIndex: 2,
        payload: { choiceId: 'x' },
        isCorrect: true,
        pointsAwarded: 100,
        elapsedMs: 1200,
      },
      {
        participantId: 'b',
        questionIndex: 0,
        payload: { choiceId: 'x' },
        isCorrect: null,
        pointsAwarded: 0,
        elapsedMs: 50,
      },
    ];
    const stats = answerStatsByParticipant(answers);
    expect(stats.get('a')).toEqual({ given: 3, correct: 2, correctElapsedMs: 2000 });
    expect(stats.get('b')).toEqual({ given: 1, correct: 0, correctElapsedMs: 0 }); // a poll vote counts as given
    expect(stats.get('c')).toBeUndefined();
    // The ranking's tie-breaker is that very sum.
    const participants: StatsParticipant[] = [
      { participantId: 'a', nickname: 'A', score: 200, isKicked: false, joinedAt: 1 },
      { participantId: 'b', nickname: 'B', score: 200, isKicked: false, joinedAt: 2 },
    ];
    expect(buildRanking(participants, answers).map((r) => r.totalCorrectElapsedMs)).toEqual([0, 2000]);
  });
});
