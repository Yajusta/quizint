// Global limits and constants — single source of truth for validation bounds.

export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
export const SESSION_CODE_LENGTH = 6;

export const MAX_PARTICIPANTS_PER_SESSION = 500;
export const MAX_JOINS_PER_SECOND_PER_SESSION = 30;

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
// Upper bound on every password field (login included): Argon2 hashes whatever it is given, so an
// unbounded body would let one request burn CPU and memory on a multi-megabyte "password".
export const ADMIN_PASSWORD_MAX_LENGTH = 256;

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

// Upload hardening (security audit, lot C).
/**
 * Decoded-pixel cap handed to sharp (`limitInputPixels`), checked from the header before any
 * decode: a decompression bomb (a few kB of PNG claiming 50 000 × 50 000) is refused instead of
 * allocating gigabytes. 40 MP stays above anything an admin legitimately uploads (a 24 MP camera
 * photo, an 8K frame at 33 MP) while bounding a decode to ~160 MB of RGBA, far under sharp's own
 * default of 268 MP. For an animated GIF the count covers every frame (width × height × pages).
 */
export const IMAGE_MAX_INPUT_PIXELS = 40_000_000;
/** Multipart bounds of POST /media: one file, a couple of stray fields at most, tiny values. */
export const UPLOAD_MULTIPART_MAX_FILES = 1;
export const UPLOAD_MULTIPART_MAX_FIELDS = 4;
export const UPLOAD_MULTIPART_MAX_PARTS = 5;
export const UPLOAD_MULTIPART_MAX_FIELD_SIZE = 1024; // bytes per non-file field value
