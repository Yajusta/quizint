// Environment validation (config.ts): fail closed on an unset NODE_ENV, low-entropy JWT_SECRET refused.

import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  devJwtSecretWarning,
  isDevOrTestEnv,
  parseEnv,
  usesDevJwtSecret,
  weakSecretReason,
} from '../src/config.js';

const DATABASE_URL = 'file:../data/unused.db';
const DEV_SECRET = 'dev-only-insecure-secret-change-me-32b!';
const strongSecret = () => randomBytes(48).toString('base64');

describe('NODE_ENV fail-closed', () => {
  it('treats an unset NODE_ENV as production', () => {
    expect(parseEnv({ DATABASE_URL, JWT_SECRET: strongSecret() }).NODE_ENV).toBe('production');
    expect(isDevOrTestEnv(undefined)).toBe(false);
    expect(isDevOrTestEnv('')).toBe(false);
    expect(isDevOrTestEnv('production')).toBe(false);
    expect(isDevOrTestEnv('development')).toBe(true);
    expect(isDevOrTestEnv('test')).toBe(true);
  });

  it('refuses to start with no NODE_ENV and no JWT_SECRET', () => {
    expect(() => parseEnv({ DATABASE_URL })).toThrow(/JWT_SECRET is required/);
  });

  it('refuses the public dev secret or the deploy placeholder when NODE_ENV is unset', () => {
    expect(() => parseEnv({ DATABASE_URL, JWT_SECRET: DEV_SECRET })).toThrow(/JWT_SECRET is required/);
    expect(() => parseEnv({ DATABASE_URL, JWT_SECRET: 'change-me-at-least-32-bytes-long-secret' })).toThrow(
      /JWT_SECRET is required/,
    );
  });

  it('refuses the template seed password when NODE_ENV is unset', () => {
    expect(() =>
      parseEnv({ DATABASE_URL, JWT_SECRET: strongSecret(), SEED_ADMIN_PASSWORD: 'admin-password-12' }),
    ).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it('refuses a missing secret in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', DATABASE_URL })).toThrow(/JWT_SECRET is required/);
  });

  it('falls back to the dev secret in development, with a startup warning', () => {
    const env = parseEnv({ NODE_ENV: 'development', DATABASE_URL });
    expect(usesDevJwtSecret(env)).toBe(true);
    expect(devJwtSecretWarning(env)).toMatch(/public development secret/);
  });

  it('falls back silently in test', () => {
    const env = parseEnv({ NODE_ENV: 'test', DATABASE_URL });
    expect(usesDevJwtSecret(env)).toBe(true);
    expect(devJwtSecretWarning(env)).toBeNull();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging', DATABASE_URL, JWT_SECRET: strongSecret() })).toThrow(
      /NODE_ENV/,
    );
  });
});

describe('JWT_SECRET entropy', () => {
  it('accepts random base64 secrets of 48 bytes (openssl rand -base64 48)', () => {
    for (let i = 0; i < 200; i++) {
      const secret = strongSecret();
      expect(weakSecretReason(secret)).toBeNull();
      const env = parseEnv({ NODE_ENV: 'production', DATABASE_URL, JWT_SECRET: secret });
      expect(env.JWT_SECRET).toBe(secret);
      expect(usesDevJwtSecret(env)).toBe(false);
      expect(devJwtSecretWarning(env)).toBeNull();
    }
  });

  it('accepts a random 32-character hex secret', () => {
    for (let i = 0; i < 200; i++) expect(weakSecretReason(randomBytes(16).toString('hex'))).toBeNull();
  });

  it('refuses too few distinct characters', () => {
    expect(weakSecretReason('a'.repeat(40))).toMatch(/distinct/);
    expect(weakSecretReason(`${'a'.repeat(39)}b`)).toMatch(/distinct/);
    expect(weakSecretReason('1234567'.repeat(6))).toMatch(/distinct/);
  });

  it('refuses a repeated pattern', () => {
    expect(weakSecretReason('passw0rd!'.repeat(4))).toMatch(/repeated/);
    expect(weakSecretReason(`${'abcdefghij'.repeat(3)}abcde`)).toMatch(/repeated/);
    expect(weakSecretReason('0123456789abcdef'.repeat(2))).toMatch(/repeated/);
  });

  it('refuses a weak secret in every NODE_ENV, with the generation hint', () => {
    for (const NODE_ENV of ['development', 'test', 'production']) {
      expect(() => parseEnv({ NODE_ENV, DATABASE_URL, JWT_SECRET: 'x'.repeat(48) })).toThrow(
        /openssl rand -base64 48/,
      );
    }
  });

  it('keeps the minimum length', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'production', DATABASE_URL, JWT_SECRET: strongSecret().slice(0, 31) }),
    ).toThrow(/at least 32 bytes/);
  });

  it('lets the public dev secret through the entropy check (NODE_ENV refuses it instead)', () => {
    expect(weakSecretReason(DEV_SECRET)).toBeNull();
  });
});
