import { describe, expect, it } from 'vitest';

import { FIXTURE_QUIZ_SNAPSHOT } from './fixtures.js';
import { answeredInOrder, buildQuizSnapshot, toParticipantQuestionView } from '../src/projections.js';
import type { QuizForSnapshot } from '../src/projections.js';

// §6.3 / §10 — automatic leak test: no isCorrect / numericAnswer / correctAnswer / explanation key
// may appear in any participant payload emitted BEFORE closure.
function assertNoLeak(payload: unknown, path = 'payload') {
  const json = JSON.stringify(payload);
  expect(json, `leak in ${path}`).not.toContain('isCorrect');
  expect(json, `leak in ${path}`).not.toContain('numericAnswer');
  expect(json, `leak in ${path}`).not.toContain('correctAnswer');
  expect(json, `leak in ${path}`).not.toContain('explanation');
}

describe('toParticipantQuestionView — leak prevention', () => {
  for (const q of FIXTURE_QUIZ_SNAPSHOT.questions) {
    it(`strips the answer from question ${q.position} (${q.type})`, () => {
      const view = toParticipantQuestionView({ ...q, explanation: 'Parce que.' });
      assertNoLeak(view, `question ${q.position}`);
    });
  }

  it('keeps prompt, type and choice labels', () => {
    const q = FIXTURE_QUIZ_SNAPSHOT.questions[0]!;
    const view = toParticipantQuestionView(q);
    expect(view.prompt).toBe(q.prompt);
    expect(view.type).toBe('MCQ');
    expect(view.choices.map((c) => c.label)).toEqual(['CSV', 'Parquet', 'JSON']);
  });

  it('hides the media URL when mediaOnParticipants is false', () => {
    const q: (typeof FIXTURE_QUIZ_SNAPSHOT.questions)[number] = {
      ...FIXTURE_QUIZ_SNAPSHOT.questions[0]!,
      media: {
        kind: 'AUDIO',
        url: 'https://example.com/uploads/x.mp3',
        width: null,
        height: null,
        durationSec: 12,
      },
      mediaOnParticipants: false,
    };
    const view = toParticipantQuestionView(q);
    expect(view.media).toEqual({ kind: 'AUDIO', hidden: true });
  });

  it('keeps the media when mediaOnParticipants is true', () => {
    const q: (typeof FIXTURE_QUIZ_SNAPSHOT.questions)[number] = {
      ...FIXTURE_QUIZ_SNAPSHOT.questions[0]!,
      media: {
        kind: 'IMAGE',
        url: 'https://example.com/uploads/x.webp',
        width: 800,
        height: 600,
        durationSec: null,
      },
      mediaOnParticipants: true,
    };
    const view = toParticipantQuestionView(q);
    expect(view.media).toEqual({
      kind: 'IMAGE',
      url: 'https://example.com/uploads/x.webp',
      width: 800,
      height: 600,
      durationSec: null,
    });
  });
});

describe('buildQuizSnapshot', () => {
  const quiz: QuizForSnapshot = {
    id: '00000000-0000-4000-8000-0000000000aa',
    title: 'T',
    description: null,
    questions: [
      {
        id: '00000000-0000-4000-8000-0000000000q1',
        position: 1,
        type: 'MCQ',
        prompt: 'Q',
        explanation: 'Parce que.',
        mediaOnParticipants: true,
        pointsCorrect: 100,
        pointsWrong: 0,
        timeLimitSec: 20,
        speedBonusMax: 0,
        numericAnswer: null,
        media: { kind: 'IMAGE', storageKey: 'abc.webp', width: 1600, height: 900, durationSec: null },
        choices: [
          {
            id: '00000000-0000-4000-8000-0000000000c1',
            position: 0,
            label: 'A',
            isCorrect: true,
            media: null,
          },
          {
            id: '00000000-0000-4000-8000-0000000000c2',
            position: 1,
            label: 'B',
            isCorrect: false,
            media: null,
          },
        ],
      },
      {
        id: '00000000-0000-4000-8000-0000000000q2',
        position: 0,
        type: 'NUMERIC',
        prompt: 'N',
        explanation: null,
        mediaOnParticipants: true,
        pointsCorrect: 50,
        pointsWrong: 0,
        timeLimitSec: null,
        speedBonusMax: 0,
        numericAnswer: { value: 8, tolerance: 0, toleranceMode: 'ABSOLUTE' },
        media: null,
        choices: [],
      },
    ],
  };

  it('freezes the quiz with media URLs from the public URL', () => {
    const snap = buildQuizSnapshot(quiz, 'https://quiz.example.fr/', new Date('2026-01-01T00:00:00Z'));
    // questions sorted by position: q2 (position 0) first, then q1 (media).
    expect(snap.questions[1]?.media?.url).toBe('https://quiz.example.fr/uploads/abc.webp');
    expect(snap.snapshotAt).toBe('2026-01-01T00:00:00.000Z');
  });
  it('freezes the explanation', () => {
    const snap = buildQuizSnapshot(quiz, 'https://x.fr');
    expect(snap.questions.map((q) => q.explanation)).toEqual([null, 'Parce que.']);
  });
  it('sorts questions by position', () => {
    const snap = buildQuizSnapshot(quiz, 'https://x.fr');
    expect(snap.questions[0]?.id.endsWith('q2')).toBe(true);
    expect(snap.questions[1]?.id.endsWith('q1')).toBe(true);
  });
});

describe('answeredInOrder', () => {
  it('lists who answered, first answer first, and skips those who did not', () => {
    expect(
      answeredInOrder([
        { id: 'late', elapsedMs: 9000 },
        { id: 'none', elapsedMs: undefined },
        { id: 'first', elapsedMs: 1200 },
        { id: 'tie', elapsedMs: 9000 },
      ]),
    ).toEqual(['first', 'late', 'tie']);
  });
});
