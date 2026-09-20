import { describe, expect, it } from 'vitest';

import { QUESTIONS_PER_QUIZ_MAX } from '../src/constants.js';
import { LiveSessionSettings, LiveSessionSettingsPatch, QuizExportV1 } from '../src/schemas/domain.js';
import { SettingsUpdateCommand } from '../src/schemas/events.js';
import { QuizCreateInput, QuizPatchInput } from '../src/schemas/rest.js';

describe('settings patches', () => {
  it('LiveSessionSettings fills the defaults of absent flags', () => {
    expect(LiveSessionSettings.parse({})).toEqual({
      showIntermediateRanking: true,
      showParticipantAnswers: false,
    });
  });

  it('a patch keeps absent flags absent (Zod 4 .partial() would re-inject the defaults)', () => {
    // Regression: a partial settings:update reset showIntermediateRanking to true server-side.
    expect(SettingsUpdateCommand.parse({ showParticipantAnswers: true })).toEqual({
      showParticipantAnswers: true,
    });
    expect(LiveSessionSettingsPatch.parse({})).toEqual({});
  });

  it('QuizPatchInput.settings only carries the keys sent', () => {
    const parsed = QuizPatchInput.parse({ settings: { defaultPointsCorrect: 50 } });
    expect(parsed.settings).toEqual({ defaultPointsCorrect: 50 });
  });

  it('QuizPatchInput.settings keeps the bounds of QuizSettings', () => {
    // Regression: an unbounded patch stored defaultTimeLimitSec 1, which the editor then failed to parse.
    expect(QuizPatchInput.safeParse({ settings: { defaultTimeLimitSec: 1 } }).success).toBe(false);
    expect(QuizPatchInput.safeParse({ settings: { defaultPointsCorrect: 10 ** 6 } }).success).toBe(false);
    expect(QuizPatchInput.parse({ settings: { defaultTimeLimitSec: null } }).settings).toEqual({
      defaultTimeLimitSec: null,
    });
  });

  it('QuizCreateInput.settings defaults to an empty patch (the route merges the defaults)', () => {
    expect(QuizCreateInput.parse({ title: 'Quiz' }).settings).toEqual({});
  });
});

describe('QuizExportV1', () => {
  const file = (count: number) => ({
    format: 'quiz-interactif/quiz',
    version: 1,
    title: 'Import',
    questions: Array.from({ length: count }, (_, i) => ({
      type: 'TEXT_POLL',
      prompt: `Q${i + 1}`,
      pointsCorrect: 0,
    })),
  });

  it('caps the questions like the questions PUT does', () => {
    // Regression: an import above the cap created a quiz the editor could never save again.
    expect(QuizExportV1.safeParse(file(QUESTIONS_PER_QUIZ_MAX)).success).toBe(true);
    expect(QuizExportV1.safeParse(file(QUESTIONS_PER_QUIZ_MAX + 1)).success).toBe(false);
  });
});
