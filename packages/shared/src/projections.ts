// Projections: build participant-safe views and quiz snapshots (§3.3, §2.4).
// Pure functions — tested without a server.

import type {
  ParticipantQuestionView,
  QuestionType,
  QuizSnapshot,
  SnapshotMedia,
  SnapshotQuestion,
} from './schemas/domain.js';

/**
 * Strip `choices[].isCorrect` and `numericAnswer` from a snapshot question, and
 * hide the media URL when mediaOnParticipants is false (replaced by { kind, hidden: true }).
 * This is THE leak-prevention boundary for participants before closure (§2.4 rule 2).
 */
export function toParticipantQuestionView(q: SnapshotQuestion): ParticipantQuestionView {
  return {
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    media: q.media === null ? null : q.mediaOnParticipants ? q.media : { kind: q.media.kind, hidden: true },
    mediaOnParticipants: q.mediaOnParticipants,
    pointsCorrect: q.pointsCorrect,
    pointsWrong: q.pointsWrong,
    timeLimitSec: q.timeLimitSec,
    speedBonusMax: q.speedBonusMax,
    choices: q.choices.map((c) => ({ id: c.id, position: c.position, label: c.label, media: c.media })),
  };
}

// ---------------------------------------------------------------------------
// buildQuizSnapshot — from a quiz with relations (API shape) to the frozen snapshot
// ---------------------------------------------------------------------------

/** Structural input expected from the API (Prisma row mapped). */
export interface QuizForSnapshot {
  id: string;
  title: string;
  description: string | null;
  questions: Array<{
    id: string;
    position: number;
    type: QuestionType;
    prompt: string;
    mediaOnParticipants: boolean;
    pointsCorrect: number;
    pointsWrong: number;
    timeLimitSec: number | null;
    speedBonusMax: number;
    numericAnswer: { value: number; tolerance: number; toleranceMode: 'ABSOLUTE' | 'PERCENT' } | null;
    media: {
      kind: 'IMAGE' | 'AUDIO';
      storageKey: string;
      width: number | null;
      height: number | null;
      durationSec: number | null;
    } | null;
    choices: Array<{
      id: string;
      position: number;
      label: string;
      isCorrect: boolean;
      media: {
        kind: 'IMAGE' | 'AUDIO';
        storageKey: string;
        width: number | null;
        height: number | null;
        durationSec: number | null;
      } | null;
    }>;
  }>;
}

/** Absolute URL of an upload: the one format the snapshot, the quiz export and the media lookup share. */
export function mediaUrl(publicUrl: string, storageKey: string): string {
  const base = publicUrl.replace(/\/+$/, '');
  return `${base}/uploads/${storageKey}`;
}

function toSnapshotMedia(
  publicUrl: string,
  m: QuizForSnapshot['questions'][number]['media'],
): SnapshotMedia | null {
  if (!m) return null;
  return {
    kind: m.kind,
    url: mediaUrl(publicUrl, m.storageKey),
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
  };
}

/** Freeze a quiz (with relations) into the JSON snapshot a live session works on. */
export function buildQuizSnapshot(quiz: QuizForSnapshot, publicUrl: string, now = new Date()): QuizSnapshot {
  return {
    quizId: quiz.id,
    title: quiz.title,
    description: quiz.description,
    snapshotAt: now.toISOString(),
    questions: [...quiz.questions]
      .sort((a, b) => a.position - b.position)
      .map((q) => ({
        id: q.id,
        position: q.position,
        type: q.type,
        prompt: q.prompt,
        media: toSnapshotMedia(publicUrl, q.media),
        mediaOnParticipants: q.mediaOnParticipants,
        pointsCorrect: q.pointsCorrect,
        pointsWrong: q.pointsWrong,
        timeLimitSec: q.timeLimitSec,
        speedBonusMax: q.speedBonusMax,
        choices: [...q.choices]
          .sort((a, b) => a.position - b.position)
          .map((c) => ({
            id: c.id,
            position: c.position,
            label: c.label,
            media: toSnapshotMedia(publicUrl, c.media),
            isCorrect: c.isCorrect,
          })),
        numericAnswer: q.numericAnswer,
      })),
  };
}

/**
 * Ids of the participants who answered the open question, first answer first (presenter only:
 * who answered, never what). Every elapsedMs is measured from the same opening; ties keep input order.
 */
export function answeredInOrder(
  rows: ReadonlyArray<{ id: string; elapsedMs: number | undefined }>,
): string[] {
  return rows
    .filter((r): r is { id: string; elapsedMs: number } => r.elapsedMs !== undefined)
    .sort((a, b) => a.elapsedMs - b.elapsedMs)
    .map((r) => r.id);
}
