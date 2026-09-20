// Rankings, per-question distributions and end-of-session stats (§4.4, §4.5). Pure.

import { NUMERIC_BUCKETS, PODIUM_SIZE } from './constants.js';
import type { AnswerPayload, CorrectAnswer, QuestionType, SnapshotQuestion } from './schemas/domain.js';
import type { ChoicesDistPayload, NumericDistPayload, TextDistPayload } from './schemas/events.js';
import { normalizeTextAnswer } from './text.js';

// ---------------------------------------------------------------------------
// Inputs — lightweight structural types the API maps its Prisma rows onto.
// ---------------------------------------------------------------------------

export interface StatsParticipant {
  participantId: string;
  nickname: string;
  score: number;
  isKicked: boolean;
  joinedAt: number; // epoch ms
}

export interface StatsAnswer {
  participantId: string;
  questionIndex: number;
  payload: AnswerPayload;
  isCorrect: boolean | null;
  pointsAwarded: number;
  elapsedMs: number;
}

export interface StatsQuestionResult {
  questionIndex: number;
  participantsAtClose: number;
  answersCount: number;
  correctCount: number;
}

// ---------------------------------------------------------------------------
// Ranking (§4.4)
// ---------------------------------------------------------------------------

export interface RankingRow {
  participantId: string;
  nickname: string;
  score: number;
  totalCorrectElapsedMs: number;
  joinedAt: number;
  rank: number;
}

/**
 * Sort by score desc, then sum of correct answers' elapsedMs asc (fastest first),
 * then joinedAt asc. Dense ranks with ties only when score AND time are strictly equal.
 */
export interface ParticipantAnswerStats {
  given: number;
  correct: number;
  /** Sum of the elapsed time of the correct answers: the ranking's tie-breaker. */
  correctElapsedMs: number;
}

/** One pass over the answers: the counts the CSV prints and the time the ranking sorts on. */
export function answerStatsByParticipant(
  answers: ReadonlyArray<StatsAnswer>,
): Map<string, ParticipantAnswerStats> {
  const stats = new Map<string, ParticipantAnswerStats>();
  for (const a of answers) {
    const entry = stats.get(a.participantId) ?? { given: 0, correct: 0, correctElapsedMs: 0 };
    entry.given += 1;
    if (a.isCorrect === true) {
      entry.correct += 1;
      entry.correctElapsedMs += a.elapsedMs;
    }
    stats.set(a.participantId, entry);
  }
  return stats;
}

export function buildRanking(
  participants: ReadonlyArray<StatsParticipant>,
  answers: ReadonlyArray<StatsAnswer>,
): RankingRow[] {
  const stats = answerStatsByParticipant(answers);
  const rows = participants
    .filter((p) => !p.isKicked)
    .map((p) => ({
      participantId: p.participantId,
      nickname: p.nickname,
      score: p.score,
      totalCorrectElapsedMs: stats.get(p.participantId)?.correctElapsedMs ?? 0,
      joinedAt: p.joinedAt,
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.totalCorrectElapsedMs - b.totalCorrectElapsedMs || a.joinedAt - b.joinedAt,
    );
  let currentRank = 0;
  let prevKey = '';
  rows.forEach((row, i) => {
    const key = `${row.score}:${row.totalCorrectElapsedMs}`;
    if (key !== prevKey) {
      currentRank = i + 1;
      prevKey = key;
    }
    row.rank = currentRank;
  });
  return rows;
}

export interface PodiumRow {
  rank: number;
  nickname: string;
  score: number;
}

export function podiumFrom(ranking: ReadonlyArray<RankingRow>): PodiumRow[] {
  return ranking.slice(0, PODIUM_SIZE).map((r) => ({ rank: r.rank, nickname: r.nickname, score: r.score }));
}

// ---------------------------------------------------------------------------
// Distributions (question result views)
// ---------------------------------------------------------------------------

export interface ChoiceDistributionEntry {
  choiceId: string;
  label: string;
  count: number;
}

export function buildChoiceDistribution(
  question: SnapshotQuestion,
  answers: ReadonlyArray<Pick<StatsAnswer, 'payload'>>,
): ChoiceDistributionEntry[] {
  const counts = new Map<string, number>();
  for (const c of question.choices) counts.set(c.id, 0);
  for (const a of answers) {
    if ('choiceId' in a.payload && counts.has(a.payload.choiceId)) {
      counts.set(a.payload.choiceId, (counts.get(a.payload.choiceId) ?? 0) + 1);
    }
  }
  return question.choices.map((c) => ({ choiceId: c.id, label: c.label, count: counts.get(c.id) ?? 0 }));
}

export interface NumericBucket {
  from: number;
  to: number;
  count: number;
}

export interface NumericDistribution {
  min: number;
  max: number;
  median: number;
  buckets: NumericBucket[];
}

export function buildNumericDistribution(
  answers: ReadonlyArray<Pick<StatsAnswer, 'payload'>>,
): NumericDistribution | null {
  const values = answers
    .map((a) => ('value' in a.payload ? a.payload.value : NaN))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const min = values[0] ?? 0;
  const max = values[values.length - 1] ?? 0;
  const median =
    values.length % 2 === 1
      ? (values[(values.length - 1) / 2] ?? 0)
      : ((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2;
  const bucketCount = Math.min(NUMERIC_BUCKETS, Math.max(1, values.length));
  const width = (max - min) / bucketCount || 1;
  const buckets: NumericBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    const bucket = buckets[idx];
    if (bucket) bucket.count++;
  }
  return { min, max, median, buckets };
}

export interface TextDistributionEntry {
  /** Normalised answer: upper case, no accent (see normalizeTextAnswer). */
  text: string;
  count: number;
}

/**
 * TEXT_POLL result: answers grouped under their normalised form, most given first, then
 * alphabetical. An answer that normalises to nothing (punctuation only) is left out.
 */
export function buildTextDistribution(
  answers: ReadonlyArray<Pick<StatsAnswer, 'payload'>>,
): TextDistributionEntry[] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    if (!('text' in a.payload)) continue;
    const key = normalizeTextAnswer(a.payload.text);
    if (key.length > 0) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'fr'));
}

export type QuestionDistribution = ChoicesDistPayload | NumericDistPayload | TextDistPayload;

/**
 * Distribution of a closed question, in the shape the stage event carries and the API stores.
 * One switch for the API and the mock: a new question type is a compile error here.
 */
export function buildQuestionDistribution(
  question: SnapshotQuestion,
  answers: ReadonlyArray<Pick<StatsAnswer, 'payload'>>,
  correctCount: number,
): QuestionDistribution {
  switch (question.type) {
    case 'NUMERIC': {
      const dist = buildNumericDistribution(answers);
      return {
        kind: 'NUMERIC',
        buckets: dist?.buckets ?? [],
        median: dist?.median ?? null,
        expected: question.numericAnswer?.value ?? 0,
        correctCount,
      };
    }
    case 'TEXT_POLL':
      return { kind: 'TEXT', entries: buildTextDistribution(answers) };
    case 'MCQ':
    case 'TRUE_FALSE':
    case 'POLL':
      return { kind: 'CHOICES', entries: buildChoiceDistribution(question, answers) };
  }
}

// ---------------------------------------------------------------------------
// End-of-session stats (§4.5)
// ---------------------------------------------------------------------------

export interface FinalStats {
  bestQuestion: { questionIndex: number; prompt: string; ratio: number } | null;
  worstQuestion: { questionIndex: number; prompt: string; ratio: number } | null;
  averageParticipationRate: number;
  averageScore: number;
  fastestCorrect: {
    participantId: string;
    nickname: string;
    elapsedMs: number;
    questionIndex: number;
  } | null;
  activeParticipants: number; // non-kicked, answered at least one question
  totalParticipants: number; // everyone who ever joined (non-kicked? no: everyone)
}

export function buildFinalStats(
  questions: ReadonlyArray<Pick<SnapshotQuestion, 'type' | 'prompt'>>,
  questionResults: ReadonlyArray<StatsQuestionResult & { questionIndex: number }>,
  answers: ReadonlyArray<StatsAnswer>,
  participants: ReadonlyArray<StatsParticipant>,
): FinalStats {
  // Best / worst question: graded questions only, a poll has no correct answer to take a ratio of.
  let best: FinalStats['bestQuestion'] = null;
  let worst: FinalStats['worstQuestion'] = null;
  const ratioEntries: Array<{ questionIndex: number; prompt: string; ratio: number }> = [];
  for (const qr of questionResults) {
    const q = questions[qr.questionIndex];
    if (!q || !isGradedType(q.type)) continue;
    const ratio = qr.correctCount / Math.max(1, qr.participantsAtClose);
    ratioEntries.push({ questionIndex: qr.questionIndex, prompt: q.prompt, ratio });
  }
  if (ratioEntries.length > 0) {
    const sorted = [...ratioEntries].sort((a, b) => b.ratio - a.ratio);
    best = sorted[0] ?? null;
    worst = sorted[sorted.length - 1] ?? null;
  }

  // Average participation rate over ALL questions (polls included).
  let participationSum = 0;
  for (const qr of questionResults) {
    participationSum += qr.answersCount / Math.max(1, qr.participantsAtClose);
  }
  const averageParticipationRate = questionResults.length > 0 ? participationSum / questionResults.length : 0;

  // Average score of non-kicked participants.
  const nonKicked = participants.filter((p) => !p.isKicked);
  const averageScore =
    nonKicked.length > 0 ? nonKicked.reduce((sum, p) => sum + p.score, 0) / nonKicked.length : 0;

  // Fastest correct answer.
  let fastest: FinalStats['fastestCorrect'] = null;
  const answeredIds = new Set(answers.map((a) => a.participantId));
  const nicknameById = new Map(participants.map((p) => [p.participantId, p.nickname]));
  const kickedIds = new Set(participants.filter((p) => p.isKicked).map((p) => p.participantId));
  for (const a of answers) {
    if (a.isCorrect !== true) continue;
    if (fastest === null || a.elapsedMs < fastest.elapsedMs) {
      fastest = {
        participantId: a.participantId,
        nickname: nicknameById.get(a.participantId) ?? '?',
        elapsedMs: a.elapsedMs,
        questionIndex: a.questionIndex,
      };
    }
  }

  return {
    bestQuestion: best,
    worstQuestion: worst,
    averageParticipationRate,
    averageScore,
    fastestCorrect: fastest,
    activeParticipants: [...answeredIds].filter((id) => !kickedIds.has(id)).length,
    totalParticipants: participants.filter((p) => !p.isKicked).length,
  };
}

// ---------------------------------------------------------------------------
// Correct answer reveal
// ---------------------------------------------------------------------------

export function correctAnswerFor(q: SnapshotQuestion): CorrectAnswer {
  switch (q.type) {
    case 'MCQ':
    case 'TRUE_FALSE': {
      const choice = q.choices.find((c) => c.isCorrect);
      return { choiceId: choice?.id ?? '', label: choice?.label ?? '' };
    }
    case 'NUMERIC': {
      const spec = q.numericAnswer;
      if (!spec) return null;
      return { value: spec.value, tolerance: spec.tolerance, toleranceMode: spec.toleranceMode };
    }
    case 'POLL':
    case 'TEXT_POLL':
      return null;
  }
}

export function isGradedType(type: QuestionType): boolean {
  return type === 'MCQ' || type === 'TRUE_FALSE' || type === 'NUMERIC';
}
