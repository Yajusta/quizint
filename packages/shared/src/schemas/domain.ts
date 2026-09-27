import { z } from 'zod';

import {
  CHOICE_LABEL_MAX_LENGTH,
  CHOICES_MAX,
  CHOICES_MIN,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NUMERIC_INPUT_MAX_LENGTH,
  POINTS_MAX,
  POINTS_MIN,
  PROMPT_MAX_LENGTH,
  QUESTIONS_PER_QUIZ_MAX,
  QUIZ_DESCRIPTION_MAX_LENGTH,
  QUIZ_TITLE_MAX_LENGTH,
  TEXT_ANSWER_MAX_LENGTH,
  TIME_LIMIT_MAX_SEC,
  TIME_LIMIT_MIN_SEC,
  TRUE_FALSE_LABEL_PAIRS,
} from '../constants.js';

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

// ADMIN does everything, account management included; USER manages only its own quizzes, sessions
// and password. Stored as a String column (SQLite has no enum): this schema is the validation.
export const AccountRole = z.enum(['ADMIN', 'USER']);
export type AccountRole = z.infer<typeof AccountRole>;

// ---------------------------------------------------------------------------
// Question / quiz domain
// ---------------------------------------------------------------------------

export const QuestionType = z.enum(['MCQ', 'TRUE_FALSE', 'NUMERIC', 'POLL', 'TEXT_POLL']);
export type QuestionType = z.infer<typeof QuestionType>;

export const MediaKind = z.enum(['IMAGE', 'AUDIO']);
export type MediaKind = z.infer<typeof MediaKind>;

export const SessionPhase = z.enum(['LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED', 'FINAL_RANKING', 'ENDED']);
export type SessionPhase = z.infer<typeof SessionPhase>;

// Expected numeric answer
export const NumericAnswerSpec = z.object({
  value: z.number().finite(),
  tolerance: z.number().min(0).default(0), // absolute tolerance
  toleranceMode: z.enum(['ABSOLUTE', 'PERCENT']).default('ABSOLUTE'),
});
export type NumericAnswerSpec = z.infer<typeof NumericAnswerSpec>;

// Effective settings of a live session (editable during the session)
export const LiveSessionSettings = z.object({
  showIntermediateRanking: z.boolean().default(true), // top 5 on the result screen
  showParticipantAnswers: z.boolean().default(false), // named list of answers shown by default
});
export type LiveSessionSettings = z.infer<typeof LiveSessionSettings>;

/**
 * Patch shape for `settings:update` and quiz settings edits. Declared without defaults on purpose:
 * Zod 4 `.partial()` keeps `.default()`, so a patch derived from `LiveSessionSettings` would reset
 * every absent flag before the server merges it. Here an absent key stays absent.
 */
export const LiveSessionSettingsPatch = z.object({
  showIntermediateRanking: z.boolean().optional(),
  showParticipantAnswers: z.boolean().optional(),
});
export type LiveSessionSettingsPatch = z.infer<typeof LiveSessionSettingsPatch>;

// Quiz settings = initial session values + default values for the editor
export const QuizSettings = LiveSessionSettings.extend({
  defaultPointsCorrect: z.number().int().min(POINTS_MIN).max(POINTS_MAX).default(100),
  defaultPointsWrong: z.number().int().min(POINTS_MIN).max(POINTS_MAX).default(0),
  defaultTimeLimitSec: z
    .number()
    .int()
    .min(TIME_LIMIT_MIN_SEC)
    .max(TIME_LIMIT_MAX_SEC)
    .nullable()
    .default(null),
});
export type QuizSettings = z.infer<typeof QuizSettings>;

export const ChoiceInput = z.object({
  id: z.string().uuid().optional(), // absent = nouveau choix
  label: z.string().trim().min(1).max(CHOICE_LABEL_MAX_LENGTH),
  mediaId: z.string().uuid().nullable().default(null),
  isCorrect: z.boolean().default(false),
});
export type ChoiceInput = z.infer<typeof ChoiceInput>;

interface QuestionShape {
  type: z.infer<typeof QuestionType>;
  choices: Array<{ label: string; isCorrect: boolean }>;
  numericAnswer: z.infer<typeof NumericAnswerSpec> | null;
  pointsCorrect: number;
  pointsWrong: number;
  speedBonusMax: number;
  timeLimitSec: number | null;
}

interface ShapeIssue {
  path: (string | number)[];
  message: string;
}

export function validateQuestionShape(q: QuestionShape): ShapeIssue[] {
  const issues: ShapeIssue[] = [];
  const norm = (l: string) => l.trim().toLowerCase();
  const correctCount = q.choices.filter((c) => c.isCorrect).length;

  switch (q.type) {
    case 'MCQ':
      if (q.choices.length < CHOICES_MIN || q.choices.length > CHOICES_MAX) {
        issues.push({ path: ['choices'], message: 'MCQ requires 2 to 6 choices' });
      }
      if (correctCount !== 1) {
        issues.push({ path: ['choices'], message: 'MCQ requires exactly one correct choice' });
      }
      if (q.numericAnswer !== null) {
        issues.push({ path: ['numericAnswer'], message: 'numericAnswer must be null for MCQ' });
      }
      break;
    case 'TRUE_FALSE':
      if (q.choices.length !== 2) {
        issues.push({ path: ['choices'], message: 'TRUE_FALSE requires exactly 2 choices' });
      } else {
        // Both labels from the same pair: « Vrai » / « False » is refused.
        const labels = q.choices.map((c) => norm(c.label));
        if (!TRUE_FALSE_LABEL_PAIRS.some(([yes, no]) => labels.includes(yes) && labels.includes(no))) {
          issues.push({
            path: ['choices'],
            message: `TRUE_FALSE choices must be one of: ${TRUE_FALSE_LABEL_PAIRS.map(([yes, no]) => `"${yes}" / "${no}"`).join(', ')}`,
          });
        }
      }
      if (correctCount !== 1) {
        issues.push({ path: ['choices'], message: 'TRUE_FALSE requires exactly one correct choice' });
      }
      if (q.numericAnswer !== null) {
        issues.push({ path: ['numericAnswer'], message: 'numericAnswer must be null for TRUE_FALSE' });
      }
      break;
    case 'POLL':
      if (q.choices.length < CHOICES_MIN || q.choices.length > CHOICES_MAX) {
        issues.push({ path: ['choices'], message: 'POLL requires 2 to 6 choices' });
      }
      if (correctCount !== 0) {
        issues.push({ path: ['choices'], message: 'POLL requires zero correct choices' });
      }
      if (q.pointsCorrect !== 0 || q.pointsWrong !== 0) {
        issues.push({ path: ['pointsCorrect'], message: 'POLL must be worth 0 point' });
      }
      if (q.speedBonusMax !== 0) {
        issues.push({ path: ['speedBonusMax'], message: 'POLL cannot have a speed bonus' });
      }
      if (q.numericAnswer !== null) {
        issues.push({ path: ['numericAnswer'], message: 'numericAnswer must be null for POLL' });
      }
      break;
    case 'TEXT_POLL':
      if (q.choices.length !== 0) {
        issues.push({ path: ['choices'], message: 'TEXT_POLL requires no choices' });
      }
      if (q.pointsCorrect !== 0 || q.pointsWrong !== 0) {
        issues.push({ path: ['pointsCorrect'], message: 'TEXT_POLL must be worth 0 point' });
      }
      if (q.speedBonusMax !== 0) {
        issues.push({ path: ['speedBonusMax'], message: 'TEXT_POLL cannot have a speed bonus' });
      }
      if (q.numericAnswer !== null) {
        issues.push({ path: ['numericAnswer'], message: 'numericAnswer must be null for TEXT_POLL' });
      }
      break;
    case 'NUMERIC':
      if (q.choices.length !== 0) {
        issues.push({ path: ['choices'], message: 'NUMERIC requires no choices' });
      }
      if (q.numericAnswer === null) {
        issues.push({ path: ['numericAnswer'], message: 'NUMERIC requires numericAnswer' });
      } else if (q.numericAnswer.toleranceMode === 'PERCENT' && q.numericAnswer.value === 0) {
        issues.push({
          path: ['numericAnswer'],
          message: 'PERCENT tolerance is forbidden when value is 0',
        });
      }
      break;
  }

  if (q.speedBonusMax > 0 && q.timeLimitSec === null) {
    issues.push({ path: ['speedBonusMax'], message: 'speedBonusMax requires timeLimitSec' });
  }
  return issues;
}

export const QuestionInput = z
  .object({
    id: z.string().uuid().optional(), // absent = nouvelle question
    type: QuestionType,
    prompt: z.string().trim().min(1).max(PROMPT_MAX_LENGTH),
    mediaId: z.string().uuid().nullable().default(null),
    mediaOnParticipants: z.boolean().default(true),
    pointsCorrect: z.number().int().min(POINTS_MIN).max(POINTS_MAX).default(100),
    pointsWrong: z.number().int().min(POINTS_MIN).max(POINTS_MAX).default(0),
    timeLimitSec: z.number().int().min(TIME_LIMIT_MIN_SEC).max(TIME_LIMIT_MAX_SEC).nullable().default(null),
    speedBonusMax: z.number().int().min(0).max(POINTS_MAX).default(0),
    choices: z.array(ChoiceInput).max(CHOICES_MAX).default([]),
    numericAnswer: NumericAnswerSpec.nullable().default(null),
  })
  .superRefine((q, ctx) => {
    for (const issue of validateQuestionShape(q)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type QuestionInput = z.infer<typeof QuestionInput>;

export const QuizInput = z.object({
  title: z.string().trim().min(1).max(QUIZ_TITLE_MAX_LENGTH),
  description: z.string().trim().max(QUIZ_DESCRIPTION_MAX_LENGTH).nullable().default(null),
  settings: QuizSettings.default({
    showIntermediateRanking: true,
    showParticipantAnswers: false,
    defaultPointsCorrect: 100,
    defaultPointsWrong: 0,
    defaultTimeLimitSec: null,
  }),
});
export type QuizInput = z.infer<typeof QuizInput>;

// ---------------------------------------------------------------------------
// Import / export format (QuizExportV1) — LLM-friendly
// ---------------------------------------------------------------------------

const ExportMedia = z.object({ kind: MediaKind, url: z.string().url() });

export const QuizExportChoice = z.object({
  label: z.string().trim().min(1).max(CHOICE_LABEL_MAX_LENGTH),
  media: ExportMedia.nullable().default(null),
  isCorrect: z.boolean().default(false),
});
export type QuizExportChoice = z.infer<typeof QuizExportChoice>;

export const QuizExportQuestion = z
  .object({
    type: QuestionType,
    prompt: z.string().trim().min(1).max(PROMPT_MAX_LENGTH),
    media: ExportMedia.nullable().default(null),
    mediaOnParticipants: z.boolean().default(true),
    pointsCorrect: z.number().int().min(POINTS_MIN).max(POINTS_MAX).default(100),
    pointsWrong: z.number().int().min(POINTS_MIN).max(POINTS_MAX).default(0),
    timeLimitSec: z.number().int().min(TIME_LIMIT_MIN_SEC).max(TIME_LIMIT_MAX_SEC).nullable().default(null),
    speedBonusMax: z.number().int().min(0).max(POINTS_MAX).default(0),
    choices: z.array(QuizExportChoice).max(CHOICES_MAX).default([]),
    numericAnswer: NumericAnswerSpec.nullable().default(null),
  })
  .superRefine((q, ctx) => {
    const mapped: QuestionShape = {
      type: q.type,
      choices: q.choices.map((c) => ({ label: c.label, isCorrect: c.isCorrect })),
      numericAnswer: q.numericAnswer,
      pointsCorrect: q.pointsCorrect,
      pointsWrong: q.pointsWrong,
      speedBonusMax: q.speedBonusMax,
      timeLimitSec: q.timeLimitSec,
    };
    for (const issue of validateQuestionShape(mapped)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type QuizExportQuestion = z.infer<typeof QuizExportQuestion>;

export const QuizExportV1 = z.object({
  format: z.literal('quiz-interactif/quiz'),
  version: z.literal(1),
  title: z.string().trim().min(1).max(QUIZ_TITLE_MAX_LENGTH),
  description: z.string().trim().max(QUIZ_DESCRIPTION_MAX_LENGTH).nullable().default(null),
  settings: QuizSettings.partial().default({}),
  // Same cap as the questions PUT: an import above it would create a quiz the editor cannot save.
  questions: z.array(QuizExportQuestion).max(QUESTIONS_PER_QUIZ_MAX).default([]),
});
export type QuizExportV1 = z.infer<typeof QuizExportV1>;

// ---------------------------------------------------------------------------
// Snapshots (frozen quiz copy a live session works on)
// ---------------------------------------------------------------------------

export const SnapshotMedia = z.object({
  kind: MediaKind,
  url: z.string(),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null),
  durationSec: z.number().nullable().default(null),
});
export type SnapshotMedia = z.infer<typeof SnapshotMedia>;

export const HiddenSnapshotMedia = z.object({
  kind: MediaKind,
  hidden: z.literal(true),
});
export type HiddenSnapshotMedia = z.infer<typeof HiddenSnapshotMedia>;

export const SnapshotChoice = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: z.string(),
  media: SnapshotMedia.nullable(),
  isCorrect: z.boolean(),
});
export type SnapshotChoice = z.infer<typeof SnapshotChoice>;

export const SnapshotQuestion = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  type: QuestionType,
  prompt: z.string(),
  media: SnapshotMedia.nullable(),
  mediaOnParticipants: z.boolean(),
  pointsCorrect: z.number().int(),
  pointsWrong: z.number().int(),
  timeLimitSec: z.number().int().nullable(),
  speedBonusMax: z.number().int(),
  choices: z.array(SnapshotChoice),
  numericAnswer: NumericAnswerSpec.nullable(),
});
export type SnapshotQuestion = z.infer<typeof SnapshotQuestion>;

export const QuizSnapshot = z.object({
  quizId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  questions: z.array(SnapshotQuestion),
  snapshotAt: z.string().datetime(),
});
export type QuizSnapshot = z.infer<typeof QuizSnapshot>;

// ---------------------------------------------------------------------------
// Participant view — SnapshotQuestion WITHOUT choices[].isCorrect nor numericAnswer.
// If mediaOnParticipants = false, `media` is replaced by { kind, hidden: true }.
// ---------------------------------------------------------------------------

export const ParticipantChoiceView = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: z.string(),
  media: SnapshotMedia.nullable(),
});
export type ParticipantChoiceView = z.infer<typeof ParticipantChoiceView>;

export const ParticipantQuestionView = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  type: QuestionType,
  prompt: z.string(),
  media: z.union([SnapshotMedia, HiddenSnapshotMedia]).nullable(),
  mediaOnParticipants: z.boolean(),
  pointsCorrect: z.number().int(),
  pointsWrong: z.number().int(),
  timeLimitSec: z.number().int().nullable(),
  speedBonusMax: z.number().int(),
  choices: z.array(ParticipantChoiceView),
});
export type ParticipantQuestionView = z.infer<typeof ParticipantQuestionView>;

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

// Answer as SENT by the client (number = string, parsed server-side)
export const AnswerSubmission = z.union([
  z.object({ choiceId: z.string().uuid() }),
  z.object({ value: z.string().min(1).max(NUMERIC_INPUT_MAX_LENGTH) }),
  // Length re-checked after whitespace collapsing by parseTextInput(); the raw bound only caps the payload.
  z.object({
    text: z
      .string()
      .min(1)
      .max(TEXT_ANSWER_MAX_LENGTH * 2),
  }),
]);
export type AnswerSubmission = z.infer<typeof AnswerSubmission>;

// NORMALISED answer, stored in the database and used by scoreAnswer()
export const AnswerPayload = z.union([
  z.object({ choiceId: z.string().uuid() }),
  z.object({ value: z.number().finite() }),
  z.object({ text: z.string() }), // TEXT_POLL: as typed, whitespace collapsed (see text.ts)
]);
export type AnswerPayload = z.infer<typeof AnswerPayload>;

// Correct answer revealed at closure
export const CorrectAnswer = z.union([
  z.object({ choiceId: z.string().uuid(), label: z.string() }),
  z.object({
    value: z.number(),
    tolerance: z.number(),
    toleranceMode: z.enum(['ABSOLUTE', 'PERCENT']),
  }),
  z.null(), // POLL, TEXT_POLL
]);
export type CorrectAnswer = z.infer<typeof CorrectAnswer>;

export const Nickname = z.string().trim().min(NICKNAME_MIN_LENGTH).max(NICKNAME_MAX_LENGTH);
export type Nickname = z.infer<typeof Nickname>;
