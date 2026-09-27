// Argon2id password hashing (§10) — shared by the auth routes and the seed script.

import { hash as argonHash, verify as argonVerify } from 'argon2';

import {
  ARGON2_BUSY_RETRY_AFTER_S,
  ARGON2_MAX_CONCURRENCY,
  ARGON2_MAX_QUEUE,
  ARGON2_QUEUE_TIMEOUT_MS,
} from '@quiz/shared';

import { RateLimitedError } from './rate-limit.js';

export const ARGON_OPTS = { memoryCost: 65536, timeCost: 3 } as const;

/**
 * The password limiter is saturated (queue full, or the wait timed out). A RateLimitedError, so the
 * app's error handler answers it 429 RATE_LIMITED with a Retry-After; the login route gives the
 * attempt back to the account budget like any other thrown error.
 */
export class PasswordHashingBusyError extends RateLimitedError {
  constructor() {
    super(ARGON2_BUSY_RETRY_AFTER_S);
  }
}

interface Waiter {
  resolve: () => void;
  timer: NodeJS.Timeout;
}

/**
 * Runs at most `maxConcurrent` tasks at once; up to `maxQueue` more wait (served in arrival order),
 * each for at most `timeoutMs`. Past the queue bound, or on timeout, the task is refused with
 * PasswordHashingBusyError without ever running.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number,
    private readonly timeoutMs: number,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new RangeError(`ConcurrencyLimiter maxConcurrent must be an integer >= 1, got ${maxConcurrent}`);
    }
    if (!Number.isInteger(maxQueue) || maxQueue < 0) {
      throw new RangeError(`ConcurrencyLimiter maxQueue must be an integer >= 0, got ${maxQueue}`);
    }
    // setTimeout turns NaN, <= 0 and > 2^31-1 (Infinity included) into 1 ms: the queue would vanish.
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2 ** 31 - 1) {
      throw new RangeError(
        `ConcurrencyLimiter timeoutMs must be an integer in [1, 2^31-1], got ${timeoutMs}`,
      );
    }
  }

  get running(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiters.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maxQueue) return Promise.reject(new PasswordHashingBusyError());
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        timer: setTimeout(() => {
          const i = this.waiters.indexOf(waiter);
          if (i !== -1) this.waiters.splice(i, 1);
          reject(new PasswordHashingBusyError());
        }, this.timeoutMs),
      };
      waiter.timer.unref();
      this.waiters.push(waiter);
    });
  }

  private release(): void {
    // The slot is handed over to the next waiter: `active` is not decremented in between, so a new
    // arrival cannot jump in front of it.
    const next = this.waiters.shift();
    if (!next) {
      this.active--;
      return;
    }
    clearTimeout(next.timer);
    next.resolve();
  }
}

/** One per process (a single API process, see CLAUDE.md): every Argon2 call goes through it. */
export const argon2Limiter = new ConcurrencyLimiter(
  ARGON2_MAX_CONCURRENCY,
  ARGON2_MAX_QUEUE,
  ARGON2_QUEUE_TIMEOUT_MS,
);

export async function hashPassword(password: string): Promise<string> {
  return argon2Limiter.run(() => argonHash(password, ARGON_OPTS));
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2Limiter.run(() => argonVerify(hash, password));
}

/**
 * Verifies `current` against `hash` and, when it matches, hashes `next` — in ONE limiter slot, so
 * a saturated limiter refuses the whole operation up front instead of between the two steps (where a
 * 429 after a successful verify would tell a right guess from a wrong one). Null on a wrong password.
 */
export async function verifyThenHash(hash: string, current: string, next: string): Promise<string | null> {
  return argon2Limiter.run(async () =>
    (await argonVerify(hash, current)) ? argonHash(next, ARGON_OPTS) : null,
  );
}
