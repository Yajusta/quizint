// Editor model (plan § 5.3, lot 4): client-side shape of a question, conversions to and from the
// REST DTOs, validation mirroring `QuestionInput` / `validateQuestionShape`, the 24 h local draft
// and the shared labels. Pure functions, no React — and no strings: validation returns dictionary
// keys (`admin:validation.*`) plus their values, the panes translate them.

import {
  CHOICE_LABEL_MAX_LENGTH,
  CHOICES_MAX,
  CHOICES_MIN,
  POINTS_MAX,
  POINTS_MIN,
  PROMPT_MAX_LENGTH,
  QuestionInput,
  TIME_LIMIT_MAX_SEC,
  TIME_LIMIT_MIN_SEC,
  type QuestionDTO,
  type QuestionInput as QuestionInputType,
  type QuestionType,
} from '@quiz/shared';

export type MediaKind = 'IMAGE' | 'AUDIO';
export type ToleranceMode = 'ABSOLUTE' | 'PERCENT';

export interface EditorChoice {
  /** Client-only stable key (React lists). */
  key: string;
  /** Server id — absent for a choice created in this session. */
  id?: string;
  label: string;
  mediaId: string | null;
  isCorrect: boolean;
}

export interface EditorQuestion {
  /** Client-only stable key: `@dnd-kit` id, React key, selection. Never sent to the server. */
  key: string;
  /** Server id — absent for a question created in this session. */
  id?: string;
  type: QuestionType;
  prompt: string;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaKind: MediaKind | null;
  mediaOnParticipants: boolean;
  pointsCorrect: number;
  pointsWrong: number;
  timeLimitSec: number | null;
  speedBonusMax: number;
  choices: EditorChoice[];
  numericAnswer: { value: number; tolerance: number; toleranceMode: ToleranceMode } | null;
}

export interface QuestionDefaults {
  pointsCorrect: number;
  pointsWrong: number;
  timeLimitSec: number | null;
}

export function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newChoice(label = '', isCorrect = false): EditorChoice {
  return { key: newKey(), label, mediaId: null, isCorrect };
}

export function newQuestion(defaults: QuestionDefaults): EditorQuestion {
  return {
    key: newKey(),
    type: 'MCQ',
    prompt: '',
    mediaId: null,
    mediaUrl: null,
    mediaKind: null,
    mediaOnParticipants: true,
    pointsCorrect: defaults.pointsCorrect,
    pointsWrong: defaults.pointsWrong,
    timeLimitSec: defaults.timeLimitSec,
    speedBonusMax: 0,
    choices: [newChoice('', true), newChoice()],
    numericAnswer: null,
  };
}

// --- Server ⇄ editor ----------------------------------------------------------------------

export function fromServerQuestion(q: QuestionDTO, key = newKey()): EditorQuestion {
  return {
    key,
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    mediaId: q.mediaId,
    mediaUrl: q.media?.url ?? null,
    mediaKind: q.media?.kind ?? null,
    mediaOnParticipants: q.mediaOnParticipants,
    pointsCorrect: q.pointsCorrect,
    pointsWrong: q.pointsWrong,
    timeLimitSec: q.timeLimitSec,
    speedBonusMax: q.speedBonusMax,
    choices: q.choices.map((c) => ({
      key: newKey(),
      id: c.id,
      label: c.label,
      mediaId: c.mediaId,
      isCorrect: c.isCorrect,
    })),
    numericAnswer: q.numericAnswer,
  };
}

/** Payload of `PUT /quizzes/:id/questions` — client keys and media URLs stripped. */
export function toServerQuestion(q: EditorQuestion): QuestionInputType {
  return {
    ...(q.id ? { id: q.id } : {}),
    type: q.type,
    prompt: q.prompt.trim(),
    mediaId: q.mediaId,
    mediaOnParticipants: q.mediaOnParticipants,
    pointsCorrect: q.pointsCorrect,
    pointsWrong: q.pointsWrong,
    timeLimitSec: q.timeLimitSec,
    speedBonusMax: q.speedBonusMax,
    choices: q.choices.map((c) => ({
      ...(c.id ? { id: c.id } : {}),
      label: c.label.trim(),
      mediaId: c.mediaId,
      isCorrect: c.isCorrect,
    })),
    numericAnswer: q.numericAnswer,
  };
}

/** Stable fingerprint of what the server would receive — the dirty flag compares two of these. */
export function serialize(state: {
  title: string;
  description: string;
  questions: EditorQuestion[];
}): string {
  return JSON.stringify({
    title: state.title.trim(),
    description: state.description.trim(),
    questions: state.questions.map(toServerQuestion),
  });
}

// --- Type switch --------------------------------------------------------------------------

/** True/false wording comes from the admin's UI language: it is stored as the question's content. */
export interface TrueFalseLabels {
  trueLabel: string;
  falseLabel: string;
}

export function switchType(q: EditorQuestion, type: QuestionType, labels: TrueFalseLabels): EditorQuestion {
  switch (type) {
    case 'MCQ':
      return {
        ...q,
        type,
        numericAnswer: null,
        choices:
          q.type === 'POLL' || q.type === 'MCQ'
            ? q.choices.some((c) => c.isCorrect)
              ? q.choices
              : q.choices.map((c, i) => ({ ...c, isCorrect: i === 0 }))
            : [newChoice('', true), newChoice()],
      };
    case 'TRUE_FALSE':
      return {
        ...q,
        type,
        numericAnswer: null,
        choices: [newChoice(labels.trueLabel, true), newChoice(labels.falseLabel, false)],
      };
    case 'NUMERIC':
      return {
        ...q,
        type,
        choices: [],
        numericAnswer: q.numericAnswer ?? { value: 0, tolerance: 0, toleranceMode: 'ABSOLUTE' },
      };
    case 'POLL':
      return {
        ...q,
        type,
        numericAnswer: null,
        pointsCorrect: 0,
        pointsWrong: 0,
        speedBonusMax: 0,
        choices:
          q.type === 'MCQ' || q.type === 'POLL'
            ? q.choices.map((c) => ({ ...c, isCorrect: false }))
            : [newChoice(), newChoice()],
      };
    case 'TEXT_POLL':
      return {
        ...q,
        type,
        numericAnswer: null,
        pointsCorrect: 0,
        pointsWrong: 0,
        speedBonusMax: 0,
        choices: [],
      };
  }
}

// --- Validation (same rules as the server) -------------------------------------------------

export type IssuePath = 'prompt' | 'choices' | 'numericAnswer' | 'points' | 'timeLimitSec' | 'speedBonusMax';

export interface Issue {
  path: IssuePath;
  /** Key under `admin:validation.*`. */
  key: string;
  values?: Record<string, string | number>;
}

export function validateQuestion(q: EditorQuestion): Issue[] {
  const issues: Issue[] = [];
  const push = (path: IssuePath, key: string, values?: Issue['values']) => {
    if (!issues.some((i) => i.path === path)) issues.push({ path, key, ...(values ? { values } : {}) });
  };

  if (q.prompt.trim().length === 0) push('prompt', 'promptRequired');
  else if (q.prompt.trim().length > PROMPT_MAX_LENGTH) {
    push('prompt', 'promptTooLong', { max: PROMPT_MAX_LENGTH });
  }

  const correct = q.choices.filter((c) => c.isCorrect).length;
  if (q.type === 'MCQ' || q.type === 'POLL') {
    if (q.choices.length < CHOICES_MIN) push('choices', 'choicesTooFew');
    else if (q.choices.length > CHOICES_MAX) push('choices', 'choicesTooMany', { max: CHOICES_MAX });
    if (q.choices.some((c) => c.label.trim().length === 0)) {
      push('choices', 'choiceLabelRequired');
    }
    if (q.choices.some((c) => c.label.trim().length > CHOICE_LABEL_MAX_LENGTH)) {
      push('choices', 'choiceLabelTooLong', { max: CHOICE_LABEL_MAX_LENGTH });
    }
    if (q.type === 'MCQ' && correct !== 1) push('choices', 'correctRequired');
  }
  if (q.type === 'TRUE_FALSE' && correct !== 1) {
    push('choices', 'trueFalseRequired');
  }
  if (q.type === 'NUMERIC') {
    if (!q.numericAnswer || !Number.isFinite(q.numericAnswer.value)) {
      push('numericAnswer', 'numericValueRequired');
    } else if (q.numericAnswer.tolerance < 0) {
      push('numericAnswer', 'toleranceNegative');
    } else if (q.numericAnswer.toleranceMode === 'PERCENT' && q.numericAnswer.value === 0) {
      push('numericAnswer', 'tolerancePercentZero');
    }
  }

  const inRange = (n: number) => Number.isInteger(n) && n >= POINTS_MIN && n <= POINTS_MAX;
  if (!inRange(q.pointsCorrect) || !inRange(q.pointsWrong)) {
    push('points', 'pointsRange', { min: Math.abs(POINTS_MIN), max: POINTS_MAX });
  }
  if (q.timeLimitSec !== null) {
    if (
      !Number.isInteger(q.timeLimitSec) ||
      q.timeLimitSec < TIME_LIMIT_MIN_SEC ||
      q.timeLimitSec > TIME_LIMIT_MAX_SEC
    ) {
      push('timeLimitSec', 'timeLimitRange', { min: TIME_LIMIT_MIN_SEC, max: TIME_LIMIT_MAX_SEC });
    }
  }
  if (!Number.isInteger(q.speedBonusMax) || q.speedBonusMax < 0 || q.speedBonusMax > POINTS_MAX) {
    push('speedBonusMax', 'speedBonusRange', { max: POINTS_MAX });
  } else if (q.speedBonusMax > 0 && q.timeLimitSec === null) {
    push('speedBonusMax', 'speedBonusNeedsTime');
  }

  // Safety net: whatever the rules above miss, the server would reject — say so before it does.
  if (issues.length === 0 && !QuestionInput.safeParse(toServerQuestion(q)).success) {
    push('choices', 'invalidQuestion');
  }
  return issues;
}

// --- Labels --------------------------------------------------------------------------------

export const TYPE_ORDER: QuestionType[] = ['MCQ', 'TRUE_FALSE', 'NUMERIC', 'POLL', 'TEXT_POLL'];

/**
 * `QUIZ_LOCKED` / `VALIDATION` details the API sends back, and whether the dictionary knows them.
 * The wording lives under `admin:lockReason.<detail>`.
 */
export const LOCK_REASON_DETAILS = [
  'played question removed',
  'type changed',
  'question reordered',
  'scoring changed',
  'choices changed',
  'correct answer changed',
  'media not found',
] as const;

export function isLockReason(detail: string): boolean {
  return (LOCK_REASON_DETAILS as readonly string[]).includes(detail);
}

/** `01`, `02`… — the list number, always two digits in mono. */
export function padIndex(i: number): string {
  return String(i + 1).padStart(2, '0');
}

// --- Local draft (24 h) --------------------------------------------------------------------

export const DRAFT_TTL_MS = 24 * 3600e3;

export interface Draft {
  title: string;
  description: string;
  questions: EditorQuestion[];
  at: number;
}

const DRAFT_PREFIX = 'quiz:draft:';

export function draftKey(quizId: string | null): string {
  return `${DRAFT_PREFIX}${quizId ?? 'new'}`;
}

export function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<Draft>;
    if (
      typeof draft.title !== 'string' ||
      typeof draft.description !== 'string' ||
      !Array.isArray(draft.questions) ||
      typeof draft.at !== 'number' ||
      Date.now() - draft.at > DRAFT_TTL_MS
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return draft as Draft;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: Omit<Draft, 'at'>): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...draft, at: Date.now() }));
  } catch {
    // storage full or unavailable — the draft is a safety net, not a feature
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Drops every local draft. Called on logout: a draft carries the correct answers, and on a shared
 * projection PC the next admin to sign in must not find the previous one's work in storage.
 */
export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // storage unavailable — nothing was persisted there either
  }
}
