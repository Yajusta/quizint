// Environment configuration, validated with Zod at startup (§11.2).

import { z } from 'zod';

import { AdminCreateInput, JWT_SECRET_MIN_DISTINCT_CHARS, JWT_SECRET_MIN_LENGTH } from '@quiz/shared';

// Public, committed in .env.example: only ever acceptable in development or test.
const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-32b!';
// Every value committed in an env template is public: a production deployment that kept one of
// them would let anyone who read the repository forge admin JWTs or sign in as the seeded admin.
export const PLACEHOLDER_SECRETS = new Set([DEV_JWT_SECRET, 'change-me-at-least-32-bytes-long-secret']);
export const PLACEHOLDER_PASSWORDS = new Set(['change-me-12-chars-min', 'admin-password-12']);

/**
 * Fail closed: the development relaxations (public dev JWT secret, template passwords, loopback
 * origin aliases, non-`secure` cookies) apply only when NODE_ENV says `development` or `test`
 * explicitly. An unset NODE_ENV is production — a deployment that forgets it must not boot on the
 * public secret. `pnpm dev` / `db:seed` set `development` through `scripts/dev-env.mjs`, vitest sets
 * `test`, the production image sets `production`.
 */
export function isDevOrTestEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/** Length of the shortest unit whose repetition spells `s` (KMP failure function). */
function smallestPeriod(s: string): number {
  const fail = new Array<number>(s.length).fill(0);
  let k = 0;
  for (let i = 1; i < s.length; i++) {
    while (k > 0 && s[i] !== s[k]) k = fail[k - 1] ?? 0;
    if (s[i] === s[k]) k++;
    fail[i] = k;
  }
  return s.length - (fail[s.length - 1] ?? 0);
}

/**
 * Cheap, deterministic low-entropy check (thresholds in @quiz/shared constants): refuses a secret
 * with too few distinct characters, or made of one unit repeated at least twice. Returns the reason,
 * or null when the secret passes. It cannot prove a secret random — only catch the hand-typed ones.
 */
export function weakSecretReason(secret: string): string | null {
  if (new Set(secret).size < JWT_SECRET_MIN_DISTINCT_CHARS) {
    return `JWT_SECRET must contain at least ${JWT_SECRET_MIN_DISTINCT_CHARS} distinct characters`;
  }
  if (smallestPeriod(secret) * 2 <= secret.length) {
    return 'JWT_SECRET must not be a repeated pattern';
  }
  return null;
}

const GENERATE_HINT = 'generate one with `openssl rand -base64 48`';

const EnvSchema = z
  .object({
    // Unset means production: see isDevOrTestEnv.
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z
      .string()
      .min(JWT_SECRET_MIN_LENGTH, `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} bytes`)
      .optional(),
    PUBLIC_URL: z.string().url().default('http://localhost:5173'),
    UPLOADS_DIR: z.string().default('./uploads'),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    // Same bounds as an admin created from the back-office.
    SEED_ADMIN_PASSWORD: AdminCreateInput.shape.password.optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_SECRET) {
      const weak = weakSecretReason(env.JWT_SECRET);
      if (weak) ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: `${weak}; ${GENERATE_HINT}` });
    }
    if (isDevOrTestEnv(env.NODE_ENV)) return;
    // A production deployment (or one with no NODE_ENV) that forgets JWT_SECRET, or keeps a template
    // placeholder, must not boot.
    if (!env.JWT_SECRET || PLACEHOLDER_SECRETS.has(env.JWT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message:
          'JWT_SECRET is required unless NODE_ENV is development or test (a random string of at least ' +
          `${JWT_SECRET_MIN_LENGTH} bytes, not the template value); ${GENERATE_HINT}`,
      });
    }
    if (env.SEED_ADMIN_PASSWORD && PLACEHOLDER_PASSWORDS.has(env.SEED_ADMIN_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_ADMIN_PASSWORD'],
        message: 'SEED_ADMIN_PASSWORD must not be the template value unless NODE_ENV is development or test',
      });
    }
  })
  .transform((env) => ({ ...env, JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET }));

export type Env = z.infer<typeof EnvSchema>;

/**
 * True when the server signs with the public development secret, whether JWT_SECRET was left unset
 * or copied from .env.example. Only possible in development or test (the schema refuses it
 * otherwise); `buildApp` logs a warning at startup, since anyone can then forge an admin JWT.
 */
export function usesDevJwtSecret(env: Env): boolean {
  return env.JWT_SECRET === DEV_JWT_SECRET;
}

/**
 * Startup warning for a server signing with the public dev secret (development only: the test suite
 * uses it on purpose, and every other NODE_ENV refuses it), or null.
 */
export function devJwtSecretWarning(env: Env): string | null {
  if (env.NODE_ENV === 'test' || !usesDevJwtSecret(env)) return null;
  return (
    'JWT_SECRET is the public development secret committed in .env.example: anyone can forge admin ' +
    `tokens for this server. Set a random JWT_SECRET before exposing it (${GENERATE_HINT}).`
  );
}

/** Validates an environment (process.env by default); throws with every issue listed. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}

let cached: Env | null = null;

export function getConfig(): Env {
  cached ??= parseEnv();
  return cached;
}
