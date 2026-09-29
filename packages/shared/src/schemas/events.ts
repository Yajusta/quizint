// Socket events and commands (§6.3, §6.4) — the live protocol contract.

import { z } from 'zod';

import {
  PARTICIPANT_TOKEN_MAX_LENGTH,
  PARTICIPANT_TOKEN_MIN_LENGTH,
  SESSION_CODE_LENGTH,
} from '../constants.js';
import {
  AnswerPayload,
  AnswerSubmission,
  CorrectAnswer,
  LiveSessionSettings,
  LiveSessionSettingsPatch,
  Nickname,
  ParticipantQuestionView,
  SessionPhase,
  SnapshotQuestion,
} from './domain.js';

// ---------------------------------------------------------------------------
// Server → client events
// ---------------------------------------------------------------------------

export const AnswerSummaryEntry = z.object({
  participantId: z.string(),
  nickname: z.string(),
  payload: AnswerPayload,
  isCorrect: z.boolean().nullable(),
  pointsBase: z.number().int(),
  pointsBonus: z.number().int(),
  pointsAwarded: z.number().int(),
  elapsedMs: z.number().int(),
});
export type AnswerSummaryEntry = z.infer<typeof AnswerSummaryEntry>;

export const FastestCorrectPayload = z.object({
  participantId: z.string(),
  nickname: z.string(),
  elapsedMs: z.number().int(),
});
export type FastestCorrectPayload = z.infer<typeof FastestCorrectPayload>;

export const ChoiceDistPayload = z.object({
  choiceId: z.string().uuid(),
  label: z.string(),
  count: z.number().int(),
});
export type ChoiceDistPayload = z.infer<typeof ChoiceDistPayload>;

export const NumericBucketPayload = z.object({
  from: z.number(),
  to: z.number(),
  count: z.number().int(),
});
export type NumericBucketPayload = z.infer<typeof NumericBucketPayload>;

export const NumericDistPayload = z.object({
  kind: z.literal('NUMERIC'),
  buckets: z.array(NumericBucketPayload),
  median: z.number().nullable(),
  expected: z.number(),
  correctCount: z.number().int(),
});
export type NumericDistPayload = z.infer<typeof NumericDistPayload>;

export const TextDistEntry = z.object({
  text: z.string(), // normalised: upper case, no accent
  count: z.number().int(),
});
export type TextDistEntry = z.infer<typeof TextDistEntry>;

export const TextDistPayload = z.object({
  kind: z.literal('TEXT'),
  entries: z.array(TextDistEntry), // most given first
});
export type TextDistPayload = z.infer<typeof TextDistPayload>;

export const ChoicesDistPayload = z.object({
  kind: z.literal('CHOICES'),
  entries: z.array(ChoiceDistPayload),
});
export type ChoicesDistPayload = z.infer<typeof ChoicesDistPayload>;

export const Top5Entry = z.object({
  participantId: z.string(),
  nickname: z.string(),
  score: z.number().int(),
  rank: z.number().int(),
});
export type Top5Entry = z.infer<typeof Top5Entry>;

export const QuestionResultView = z.object({
  questionIndex: z.number().int(),
  correctAnswer: CorrectAnswer,
  answersCount: z.number().int(),
  correctCount: z.number().int(),
  distribution: z.union([ChoicesDistPayload, NumericDistPayload, TextDistPayload]),
  answers: z.array(AnswerSummaryEntry),
  fastestCorrect: FastestCorrectPayload.nullable(),
  top5: z.array(Top5Entry),
  previousRanks: z.record(z.string(), z.number().int()),
  /** The question's explanation, revealed with the answer. Null when the author wrote none. */
  explanation: z.string().nullable(),
});
export type QuestionResultView = z.infer<typeof QuestionResultView>;

export const ParticipantRoundResult = z.object({
  questionIndex: z.number().int(),
  correctAnswer: CorrectAnswer,
  yourAnswer: AnswerPayload.nullable(),
  isCorrect: z.boolean().nullable(),
  pointsBase: z.number().int(),
  pointsBonus: z.number().int(),
  pointsAwarded: z.number().int(),
  totalScore: z.number().int(),
  rank: z.number().int(),
  participantCount: z.number().int(),
  /** TEXT_POLL only: the anonymous grouped answers, as the stage shows them. Null otherwise. */
  textEntries: z.array(TextDistEntry).nullable(),
  /** Same explanation as the stage's, revealed with the answer. */
  explanation: z.string().nullable(),
});
export type ParticipantRoundResult = z.infer<typeof ParticipantRoundResult>;

export const PodiumEntry = z.object({
  rank: z.number().int(),
  nickname: z.string(),
  score: z.number().int(),
});
export type PodiumEntry = z.infer<typeof PodiumEntry>;

export const FinalStatsPayload = z.object({
  bestQuestion: z
    .object({ questionIndex: z.number().int(), prompt: z.string(), ratio: z.number() })
    .nullable(),
  worstQuestion: z
    .object({ questionIndex: z.number().int(), prompt: z.string(), ratio: z.number() })
    .nullable(),
  averageParticipationRate: z.number(),
  averageScore: z.number(),
  fastestCorrect: z
    .object({
      participantId: z.string(),
      nickname: z.string(),
      elapsedMs: z.number().int(),
      questionIndex: z.number().int(),
    })
    .nullable(),
  activeParticipants: z.number().int(),
  totalParticipants: z.number().int(),
});
export type FinalStatsPayload = z.infer<typeof FinalStatsPayload>;

export const FinalRankingView = z.object({
  podium: z.array(PodiumEntry),
  ranking: z.array(
    z.object({
      participantId: z.string(),
      nickname: z.string(),
      score: z.number().int(),
      rank: z.number().int(),
    }),
  ),
  stats: FinalStatsPayload,
});
export type FinalRankingView = z.infer<typeof FinalRankingView>;

export const ParticipantFinalView = z.object({
  yourRank: z.number().int(),
  yourScore: z.number().int(),
  podium: z.array(PodiumEntry),
  participantCount: z.number().int(),
});
export type ParticipantFinalView = z.infer<typeof ParticipantFinalView>;

export const ParticipantInfo = z.object({
  id: z.string(),
  nickname: z.string(),
  connected: z.boolean(),
  score: z.number().int(),
  isKicked: z.boolean(),
  joinedAt: z.number().int(),
});
export type ParticipantInfo = z.infer<typeof ParticipantInfo>;

// --- Snapshots (sent on every (re)connection) ------------------------------

export const SessionSnapshotForParticipant = z.object({
  sessionId: z.string(),
  code: z.string(),
  quizTitle: z.string(),
  phase: SessionPhase,
  questionIndex: z.number().int(),
  totalQuestions: z.number().int(),
  you: z.object({
    participantId: z.string(),
    nickname: z.string(),
    score: z.number().int(),
    rank: z.number().int(),
  }),
  participantCount: z.number().int(),
  question: z
    .object({
      view: ParticipantQuestionView,
      openedAt: z.number().int(),
      closesAt: z.number().int().nullable(),
      alreadyAnswered: z.boolean(),
      yourAnswer: AnswerPayload.nullable(),
    })
    .nullable(),
  roundResult: ParticipantRoundResult.nullable(),
  final: ParticipantFinalView.nullable(),
  serverTime: z.number().int(),
});
export type SessionSnapshotForParticipant = z.infer<typeof SessionSnapshotForParticipant>;

export const SessionSnapshotForPresenter = z.object({
  sessionId: z.string(),
  code: z.string(),
  joinUrl: z.string(),
  quizTitle: z.string(),
  phase: SessionPhase,
  questionIndex: z.number().int(),
  totalQuestions: z.number().int(),
  settings: LiveSessionSettings,
  participants: z.array(ParticipantInfo),
  question: z
    .object({
      view: SnapshotQuestion,
      openedAt: z.number().int(),
      closesAt: z.number().int().nullable(),
      answered: z.number().int(),
      /** Participants who answered, first answer first. */
      answeredIds: z.array(z.string()),
      connected: z.number().int(),
    })
    .nullable(),
  roundResult: QuestionResultView.nullable(),
  final: FinalRankingView.nullable(),
  serverTime: z.number().int(),
});
export type SessionSnapshotForPresenter = z.infer<typeof SessionSnapshotForPresenter>;

export const StateSnapshotEvent = z.union([SessionSnapshotForParticipant, SessionSnapshotForPresenter]);
export type StateSnapshotEvent = z.infer<typeof StateSnapshotEvent>;

// --- Event payloads -----------------------------------------------------------

export const PhaseEvent = z.object({
  phase: SessionPhase,
  questionIndex: z.number().int(),
  serverTime: z.number().int(),
});
export type PhaseEvent = z.infer<typeof PhaseEvent>;

export const QuestionOpenEvent = z.object({
  view: z.union([SnapshotQuestion, ParticipantQuestionView]),
  questionIndex: z.number().int(),
  totalQuestions: z.number().int(),
  openedAt: z.number().int(),
  closesAt: z.number().int().nullable(),
  serverTime: z.number().int(),
});
export type QuestionOpenEvent = z.infer<typeof QuestionOpenEvent>;

export const QuestionClosedPresenterEvent = z.object({
  audience: z.literal('presenter'),
  result: QuestionResultView,
});
export type QuestionClosedPresenterEvent = z.infer<typeof QuestionClosedPresenterEvent>;

export const QuestionClosedParticipantEvent = z.object({
  audience: z.literal('participant'),
  result: ParticipantRoundResult,
});
export type QuestionClosedParticipantEvent = z.infer<typeof QuestionClosedParticipantEvent>;

export const SessionFinalPresenterEvent = z.object({
  audience: z.literal('presenter'),
  final: FinalRankingView,
});
export type SessionFinalPresenterEvent = z.infer<typeof SessionFinalPresenterEvent>;

export const SessionFinalParticipantEvent = z.object({
  audience: z.literal('participant'),
  final: ParticipantFinalView,
});
export type SessionFinalParticipantEvent = z.infer<typeof SessionFinalParticipantEvent>;

export const SessionEndedEvent = z.object({ reason: z.enum(['ENDED', 'CANCELLED']) });
export type SessionEndedEvent = z.infer<typeof SessionEndedEvent>;

export const ParticipantsListEvent = z.object({
  participants: z.array(ParticipantInfo),
  count: z.number().int(),
});
export type ParticipantsListEvent = z.infer<typeof ParticipantsListEvent>;

export const AnswersProgressEvent = z.object({
  questionIndex: z.number().int(),
  answered: z.number().int(),
  connected: z.number().int(),
  total: z.number().int(),
  recent: z.array(z.string()),
  /** Participants who answered, first answer first (presenter only: who, never what). */
  answeredIds: z.array(z.string()),
});
export type AnswersProgressEvent = z.infer<typeof AnswersProgressEvent>;

export const SettingsChangedEvent = LiveSessionSettings;
export type SettingsChangedEvent = z.infer<typeof SettingsChangedEvent>;

export const LobbyCountEvent = z.object({ count: z.number().int() });
export type LobbyCountEvent = z.infer<typeof LobbyCountEvent>;

export const ParticipantKickedEvent = z.object({ message: z.string() });
export type ParticipantKickedEvent = z.infer<typeof ParticipantKickedEvent>;

// ---------------------------------------------------------------------------
// Client → server commands
// ---------------------------------------------------------------------------

export const JoinCommand = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^[A-Z0-9]{${SESSION_CODE_LENGTH}}$`), `Code à ${SESSION_CODE_LENGTH} caractères`),
  nickname: Nickname,
});
export type JoinCommand = z.infer<typeof JoinCommand>;

export const AnswerSubmitCommand = z.object({
  questionIndex: z.number().int().min(0),
  answer: AnswerSubmission,
});
export type AnswerSubmitCommand = z.infer<typeof AnswerSubmitCommand>;

export const SessionStartCommand = z.object({ force: z.boolean().optional() });
export type SessionStartCommand = z.infer<typeof SessionStartCommand>;

export const QuestionCloseCommand = z.object({ expectedIndex: z.number().int().min(0) });
export type QuestionCloseCommand = z.infer<typeof QuestionCloseCommand>;

export const QuestionNextCommand = z.object({ expectedIndex: z.number().int().min(0) });
export type QuestionNextCommand = z.infer<typeof QuestionNextCommand>;

/** From an open question back to the previous result; the open question's answers are discarded. */
export const QuestionBackCommand = z.object({ expectedIndex: z.number().int().min(1) });
export type QuestionBackCommand = z.infer<typeof QuestionBackCommand>;

/** From a result back to its question, reopened with a fresh timer; its answers are discarded. */
export const QuestionReopenCommand = z.object({ expectedIndex: z.number().int().min(0) });
export type QuestionReopenCommand = z.infer<typeof QuestionReopenCommand>;

export const ParticipantKickCommand = z.object({ participantId: z.string() });
export type ParticipantKickCommand = z.infer<typeof ParticipantKickCommand>;

// Not `LiveSessionSettings.partial()`: Zod 4 would re-inject the defaults of the absent flags.
export const SettingsUpdateCommand = LiveSessionSettingsPatch;
export type SettingsUpdateCommand = z.infer<typeof SettingsUpdateCommand>;

// Handshake auth payloads. A participant handshake without `token` is anonymous (it will
// `participant:join`); one with a malformed token is refused TOKEN_INVALID.
export const ParticipantResumeAuth = z.object({
  token: z
    .string()
    .min(PARTICIPANT_TOKEN_MIN_LENGTH, 'Jeton invalide')
    .max(PARTICIPANT_TOKEN_MAX_LENGTH, 'Jeton invalide')
    .regex(/^[A-Za-z0-9_-]+$/, 'Jeton invalide'), // base64url
});
export type ParticipantResumeAuth = z.infer<typeof ParticipantResumeAuth>;

export const PresenterAttachAuth = z.object({ sessionId: z.string().uuid() });
export type PresenterAttachAuth = z.infer<typeof PresenterAttachAuth>;

// ---------------------------------------------------------------------------
// Acks — { ok: true, ...data } | { ok: false, code, message }
// ---------------------------------------------------------------------------

export interface AckOk {
  ok: true;
  [key: string]: unknown;
}
export interface AckError {
  ok: false;
  code: string;
  message: string;
}
export type Ack = AckOk | AckError;

export const JoinAckData = z.object({
  participantId: z.string(),
  token: z.string(),
});
export type JoinAckData = z.infer<typeof JoinAckData>;
