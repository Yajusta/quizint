// Pure scoring rules (§4.3). Pure functions, exhaustively tested.

import type { AnswerPayload, SnapshotQuestion } from './schemas/domain.js';
import { matchesNumeric } from './numeric.js';

export interface ScoreResult {
  isCorrect: boolean | null; // null for POLL and TEXT_POLL
  pointsBase: number;
  pointsBonus: number;
  pointsAwarded: number;
}

/**
 * Score an answer against a frozen snapshot question.
 * - POLL, TEXT_POLL: { null, 0, 0, 0 }
 * - Incorrect: pointsBase = q.pointsWrong, no bonus.
 * - Correct: pointsBase = q.pointsCorrect; speed bonus if speedBonusMax > 0 && timeLimitSec:
 *     ratio = clamp(1 − elapsedMs / (timeLimitSec × 1000), 0, 1); pointsBonus = round(max × ratio).
 */
export function scoreAnswer(q: SnapshotQuestion, payload: AnswerPayload, elapsedMs: number): ScoreResult {
  if (q.type === 'POLL' || q.type === 'TEXT_POLL') {
    return { isCorrect: null, pointsBase: 0, pointsBonus: 0, pointsAwarded: 0 };
  }

  const correct = isCorrectAnswer(q, payload);
  if (!correct) {
    return { isCorrect: false, pointsBase: q.pointsWrong, pointsBonus: 0, pointsAwarded: q.pointsWrong };
  }

  let bonus = 0;
  if (q.speedBonusMax > 0 && q.timeLimitSec !== null) {
    const window = q.timeLimitSec * 1000;
    const ratio = Math.min(1, Math.max(0, 1 - elapsedMs / window));
    bonus = Math.round(q.speedBonusMax * ratio);
  }
  const base = q.pointsCorrect;
  return { isCorrect: true, pointsBase: base, pointsBonus: bonus, pointsAwarded: base + bonus };
}

function isCorrectAnswer(q: SnapshotQuestion, payload: AnswerPayload): boolean {
  switch (q.type) {
    case 'MCQ':
    case 'TRUE_FALSE':
      return 'choiceId' in payload && q.choices.some((c) => c.id === payload.choiceId && c.isCorrect);
    case 'NUMERIC':
      return 'value' in payload && q.numericAnswer !== null && matchesNumeric(payload.value, q.numericAnswer);
    case 'POLL':
    case 'TEXT_POLL':
      return false;
  }
}
