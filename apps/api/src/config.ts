// Environment configuration, validated with Zod at startup (§11.2).

import { z } from 'zod';

import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH } from '@quiz/shared';

// Public, committed in .env.example: only ever acceptable outside production.
const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-32b!';
// Every value committed in an env template is public: a production deployment that kept one of
// them would let anyone who read the repository forge admin JWTs or sign in as the seeded admin.
export const PLACEHOLDER_SECRETS = new Set([DEV_JWT_SECRET, 'change-me-at-least-32-bytes-long-secret']);
export const PLACEHOLDER_PASSWORDS = new Set(['change-me-12-chars-min', 'admin-password-12']);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 bytes').optional(),
    PUBLIC_URL: z.string().url().default('http://localhost:5173'),
    UPLOADS_DIR: z.string().default('./uploads'),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(ADMIN_PASSWORD_MIN_LENGTH).max(ADMIN_PASSWORD_MAX_LENGTH).optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // A production deployment that forgets JWT_SECRET, or keeps a template placeholder, must not boot.
    if (!env.JWT_SECRET || PLACEHOLDER_SECRETS.has(env.JWT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message:
          'JWT_SECRET is required in production (a random string of at least 32 bytes, not the template value)',
      });
    }
    if (env.SEED_ADMIN_PASSWORD && PLACEHOLDER_PASSWORDS.has(env.SEED_ADMIN_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_ADMIN_PASSWORD'],
        message: 'SEED_ADMIN_PASSWORD must not be the template value in production',
      });
    }
  })
  .transform((env) => ({ ...env, JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET }));

export type Env = z.infer<typeof EnvSchema>;

/**
 * True when the server signs with the public development secret, whether JWT_SECRET was left unset
 * or copied from .env.example. Only possible outside production (the schema refuses it there);
 * `buildApp` logs a warning at startup, since anyone can then forge an admin JWT.
 */
export function usesDevJwtSecret(env: Env): boolean {
  return env.JWT_SECRET === DEV_JWT_SECRET;
}

let cached: Env | null = null;

export function getConfig(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
