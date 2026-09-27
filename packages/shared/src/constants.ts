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

/**
 * Participant resume token: `randomBytes(PARTICIPANT_TOKEN_BYTES)` in base64url (43 chars as issued by
 * the API; the mock server issues a 36-char UUID). The handshake schema accepts base64url within these
 * bounds and refuses anything else as TOKEN_INVALID.
 */
export const PARTICIPANT_TOKEN_BYTES = 32;
export const PARTICIPANT_TOKEN_MIN_LENGTH = 20;
export const PARTICIPANT_TOKEN_MAX_LENGTH = 128;

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
// Password-guessing budgets per minute. Login is keyed on the client address (see
// RATE_LIMIT_IPV6_PREFIX_LENGTH) and also counted per account below; change-password on the
// admin of a verified access JWT, so a stolen session cookie cannot brute-force the current password
// (and turn a temporary theft into a takeover) by rotating IPs.
export const LOGIN_ATTEMPTS_PER_MINUTE = 10;
export const CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE = 5;
// The global REST bucket, per client address, of every /api route without a limit of its own (a
// route-level limit replaces it; change-password draws on it explicitly as well, see its route).
export const API_REQUESTS_PER_MINUTE = 2000;
/**
 * HS256 signing secret of the admin JWTs (`JWT_SECRET`, checked by apps/api/src/config.ts). Length
 * alone does not make a secret: on top of the minimum length, a secret with fewer than
 * JWT_SECRET_MIN_DISTINCT_CHARS distinct characters, or made of one unit repeated at least twice
 * (`abcabcabc…`, `passwordpassword…`), is refused. Deterministic and cheap, it only catches the
 * obviously hand-typed ones: a 32-character hex secret has ~14 distinct characters on average (the
 * odds of fewer than 8 are about 4e-8), `openssl rand -base64 48` output has ~40.
 */
export const JWT_SECRET_MIN_LENGTH = 32;
export const JWT_SECRET_MIN_DISTINCT_CHARS = 8;
/**
 * Per-account login budget, on top of the per-address one: past LOGIN_FAILURES_PER_ACCOUNT failed
 * attempts on one email within LOGIN_FAILURE_WINDOW_MS (counted from the first), every further attempt
 * on that email is refused RATE_LIMITED without hashing anything until the window ends — whatever the
 * address it comes from. Unknown emails are counted exactly like known ones (no enumeration).
 */
export const LOGIN_FAILURES_PER_ACCOUNT = 10;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/**
 * Emails the per-account counter tracks at once: past it, the oldest entry is evicted, so a flood of
 * made-up emails costs bounded memory (a key is a fixed-size hash, ~100 bytes a slot).
 */
export const LOGIN_FAILURE_TRACKED_ACCOUNTS_MAX = 20_000;
/**
 * Global cap on Argon2id work (hash and verify, login included), per API process. Each run holds one
 * libuv threadpool thread (4 by default, shared with fs, dns, zlib and sharp), plus the native
 * threads of its own lanes (argon2's default parallelism, 4), and 64 MiB for ~0.1 s: at most
 * ARGON2_MAX_CONCURRENCY run at once (bounding the pool slots and memory taken, not all CPU contention), at most ARGON2_MAX_QUEUE wait behind them, and a wait
 * longer than ARGON2_QUEUE_TIMEOUT_MS gives up. Past either bound the request is refused RATE_LIMITED
 * (Retry-After ARGON2_BUSY_RETRY_AFTER_S) without touching the account's login budget, so a burst of
 * pre-auth logins from many addresses cannot starve the rest of the process.
 */
export const ARGON2_MAX_CONCURRENCY = 2;
export const ARGON2_MAX_QUEUE = 32;
export const ARGON2_QUEUE_TIMEOUT_MS = 5_000;
export const ARGON2_BUSY_RETRY_AFTER_S = 2;

/**
 * Per-address limits (REST rate limits, socket handshake and join buckets, socket caps) key an IPv6
 * client on this prefix, not on its full address: one subscriber is routinely handed a whole /64, so
 * a per-address bucket would let it rotate through 2^64 fresh ones. IPv4 stays per address.
 */
export const RATE_LIMIT_IPV6_PREFIX_LENGTH = 64;

export const UPLOAD_MAX_IMAGE_MB = 8;
export const UPLOAD_MAX_AUDIO_MB = 15;
export const IMAGE_MAX_WIDTH = 1600;

export const NUMERIC_EPSILON = 1e-9;

export const INTERMEDIATE_RANKING_SIZE = 5;
export const PODIUM_SIZE = 3;
export const NUMERIC_BUCKETS = 12;

export const SESSION_IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6 h without a join, answer or presenter command
export const ENDED_PURGE_DELAY_MS = 60 * 1000;
/**
 * Auto-close whose write failed: retried after BASE, doubled on each failure up to MAX, until it
 * commits or a manual close, a step, an end or a delete cancels it. Never given up: a timed question
 * must not stay open for good because the disk hiccuped once.
 */
export const AUTO_CLOSE_RETRY_BASE_MS = 1000;
export const AUTO_CLOSE_RETRY_MAX_MS = 30 * 1000;

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
