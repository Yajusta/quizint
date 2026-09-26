// REST DTOs (§5) — responses and request bodies for the admin/participant HTTP API.

import { z } from 'zod';

import {
  ADMIN_DISPLAY_NAME_MAX_LENGTH,
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  QUESTIONS_PER_QUIZ_MAX,
  QUIZ_DESCRIPTION_MAX_LENGTH,
  QUIZ_TITLE_MAX_LENGTH,
} from '../constants.js';
import {
  LiveSessionSettings,
  LiveSessionSettingsPatch,
  MediaKind,
  QuestionInput,
  QuestionType,
  QuizSettings,
  SessionPhase,
} from './domain.js';

// ---------------------------------------------------------------------------
// Auth / admins
// ---------------------------------------------------------------------------

export const AdminDTO = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  isActive: z.boolean(),
  createdAt: z.number().int(),
});
export type AdminDTO = z.infer<typeof AdminDTO>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(ADMIN_PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const AdminCreateInput = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(ADMIN_DISPLAY_NAME_MAX_LENGTH),
  password: z.string().min(ADMIN_PASSWORD_MIN_LENGTH).max(ADMIN_PASSWORD_MAX_LENGTH),
});
export type AdminCreateInput = z.infer<typeof AdminCreateInput>;

// No `password` here: an admin changes their own password through /auth/change-password (current
// password required), and nobody resets a colleague's. Strict, so a body that still sends one is a
// 400 rather than a silently ignored field.
export const AdminPatchInput = z
  .object({
    displayName: z.string().trim().min(1).max(ADMIN_DISPLAY_NAME_MAX_LENGTH).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type AdminPatchInput = z.infer<typeof AdminPatchInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(ADMIN_PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(ADMIN_PASSWORD_MIN_LENGTH).max(ADMIN_PASSWORD_MAX_LENGTH),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const MediaDTO = z.object({
  id: z.string().uuid(),
  kind: MediaKind,
  mimeType: z.string(),
  originalName: z.string(),
  url: z.string(),
  sizeBytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationSec: z.number().nullable(),
  createdAt: z.number().int(),
});
export type MediaDTO = z.infer<typeof MediaDTO>;

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export const ChoiceDTO = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: z.string(),
  mediaId: z.string().uuid().nullable(),
  media: z
    .object({
      kind: MediaKind,
      url: z.string(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
      durationSec: z.number().nullable(),
    })
    .nullable(),
  isCorrect: z.boolean(),
});
export type ChoiceDTO = z.infer<typeof ChoiceDTO>;

export const QuestionDTO = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  type: QuestionType,
  prompt: z.string(),
  mediaId: z.string().uuid().nullable(),
  media: ChoiceDTO.shape.media,
  mediaOnParticipants: z.boolean(),
  pointsCorrect: z.number().int(),
  pointsWrong: z.number().int(),
  timeLimitSec: z.number().int().nullable(),
  speedBonusMax: z.number().int(),
  choices: z.array(ChoiceDTO),
  numericAnswer: z
    .object({
      value: z.number(),
      tolerance: z.number(),
      toleranceMode: z.enum(['ABSOLUTE', 'PERCENT']),
    })
    .nullable(),
});
export type QuestionDTO = z.infer<typeof QuestionDTO>;

const QuizSettingsDTO = LiveSessionSettings.extend({
  defaultPointsCorrect: z.number().int(),
  defaultPointsWrong: z.number().int(),
  defaultTimeLimitSec: z.number().int().nullable(),
});

// Patch shape without defaults (see LiveSessionSettingsPatch): an absent key must stay absent, the
// route merges it over the stored settings. The bounds are QuizSettings' own (`removeDefault()`
// keeps min/max): an out-of-range default stored here would make the editor's parse fail later.
const QuizSettingsPatch = LiveSessionSettingsPatch.extend({
  defaultPointsCorrect: QuizSettings.shape.defaultPointsCorrect.removeDefault().optional(),
  defaultPointsWrong: QuizSettings.shape.defaultPointsWrong.removeDefault().optional(),
  defaultTimeLimitSec: QuizSettings.shape.defaultTimeLimitSec.removeDefault().optional(),
});

export const QuizDTO = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  settings: QuizSettingsDTO,
  questionCount: z.number().int(),
  lastPlayedAt: z.number().int().nullable(),
  sessionCount: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type QuizDTO = z.infer<typeof QuizDTO>;

export const QuizDetailDTO = QuizDTO.extend({
  questions: z.array(QuestionDTO),
  isLocked: z.boolean(),
});
export type QuizDetailDTO = z.infer<typeof QuizDetailDTO>;

export const QuizCreateInput = z.object({
  title: z.string().trim().min(1).max(QUIZ_TITLE_MAX_LENGTH),
  description: z.string().trim().max(QUIZ_DESCRIPTION_MAX_LENGTH).nullable().default(null),
  settings: QuizSettingsPatch.default({}),
});
export type QuizCreateInput = z.infer<typeof QuizCreateInput>;

export const QuizPatchInput = z.object({
  title: z.string().trim().min(1).max(QUIZ_TITLE_MAX_LENGTH).optional(),
  description: z.string().trim().max(QUIZ_DESCRIPTION_MAX_LENGTH).nullable().optional(),
  settings: QuizSettingsPatch.optional(),
});
export type QuizPatchInput = z.infer<typeof QuizPatchInput>;

export const QuestionsReplaceInput = z.object({
  questions: z.array(QuestionInput).max(QUESTIONS_PER_QUIZ_MAX),
});
export type QuestionsReplaceInput = z.infer<typeof QuestionsReplaceInput>;

// ---------------------------------------------------------------------------
// Sessions (REST)
// ---------------------------------------------------------------------------

export const SessionSummaryDTO = z.object({
  id: z.string().uuid(),
  code: z.string(),
  quizTitle: z.string(),
  phase: SessionPhase,
  participantCount: z.number().int(),
  startedAt: z.number().int().nullable(),
  endedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type SessionSummaryDTO = z.infer<typeof SessionSummaryDTO>;

export const SessionCreatedDTO = z.object({
  sessionId: z.string().uuid(),
  code: z.string(),
  joinUrl: z.string(),
});
export type SessionCreatedDTO = z.infer<typeof SessionCreatedDTO>;

export const JoinInfoDTO = z.object({
  sessionId: z.string().uuid(),
  quizTitle: z.string(),
  phase: SessionPhase,
  participantCount: z.number().int(),
});
export type JoinInfoDTO = z.infer<typeof JoinInfoDTO>;

export const ApiError = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type ApiError = z.infer<typeof ApiError>;
