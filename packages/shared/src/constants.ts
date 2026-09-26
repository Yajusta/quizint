// Global limits and constants — single source of truth for validation bounds.

export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
export const SESSION_CODE_LENGTH = 6;

export const MAX_PARTICIPANTS_PER_SESSION = 500;
export const MAX_JOINS_PER_SECOND_PER_SESSION = 30;
/**
 * Concurrent /participant sockets from one client IP. Deliberately a full room plus headroom, not a
 * handful: a conference or a school behind one NAT is a whole room on a single address, and the seat
 * cap, the join limits and the handshake rate already stop a script from filling a session. This one
 * bounds what they do not: idle anonymous sockets piling up from one host without ever joining.
 */
export const MAX_PARTICIPANT_SOCKETS_PER_IP = MAX_PARTICIPANTS_PER_SESSION + 100;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

export const QUIZ_TITLE_MAX_LENGTH = 200;
export const QUIZ_DESCRIPTION_MAX_LENGTH = 2000;
export const QUESTIONS_PER_QUIZ_MAX = 200;
export const ADMIN_DISPLAY_NAME_MAX_LENGTH = 120;
export const NUMERIC_INPUT_MAX_LENGTH = 32; // raw string typed for a NUMERIC answer
export const TEXT_ANSWER_MAX_LENGTH = 80; // free text typed for a TEXT_POLL answer
export const ANSWERS_PAGE_SIZE_MAX = 200; // GET /sessions/:id/answers

export const PROMPT_MAX_LENGTH = 500;
export const CHOICE_LABEL_MAX_LENGTH = 120;
export const CHOICES_MIN = 2;
export const CHOICES_MAX = 6;
/**
 * Accepted wordings of a TRUE_FALSE question, lower case: one pair per UI language, since the
 * editor writes the labels in the admin's language. A new language adds its pair here.
 */
export const TRUE_FALSE_LABEL_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['vrai', 'faux'],
  ['true', 'false'],
];

export const TIME_LIMIT_MIN_SEC = 5;
export const TIME_LIMIT_MAX_SEC = 300;

export const POINTS_MIN = -10000;
export const POINTS_MAX = 10000;

export const GRACE_MS = 500; // late-answer grace after questionClosesAt

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export const UPLOAD_MAX_IMAGE_MB = 8;
export const UPLOAD_MAX_AUDIO_MB = 15;
export const IMAGE_MAX_WIDTH = 1600;

export const NUMERIC_EPSILON = 1e-9;

export const INTERMEDIATE_RANKING_SIZE = 5;
export const PODIUM_SIZE = 3;
export const NUMERIC_BUCKETS = 12;

export const SESSION_IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6 h without a join, answer or presenter command
export const ENDED_PURGE_DELAY_MS = 60 * 1000;

export const CLOCK_SYNC_SAMPLES = 5;

// A–F letters of the choices. Answer boxes are deliberately identical: no colour per choice,
// the letter is the only marker (§8.5).
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
