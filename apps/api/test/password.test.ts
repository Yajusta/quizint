import { afterEach, describe, expect, it, vi } from 'vitest';

import { ARGON2_MAX_CONCURRENCY, ARGON2_MAX_QUEUE } from '@quiz/shared';

import { RateLimitedError } from '../src/lib/rate-limit.js';
import {
  ConcurrencyLimiter,
  PasswordHashingBusyError,
  argon2Limiter,
  hashPassword,
  verifyPassword,
  verifyThenHash,
} from '../src/lib/password.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('ConcurrencyLimiter', () => {
  afterEach(() => vi.useRealTimers());

  it('runs at most maxConcurrent tasks at once and serves the queue as slots free up', async () => {
    const limiter = new ConcurrencyLimiter(2, 10, 60_000);
    const gates = Array.from({ length: 5 }, () => deferred());
    let live = 0;
    let peak = 0;
    const runs = gates.map((g, i) =>
      limiter.run(async () => {
        live++;
        peak = Math.max(peak, live);
        await g.promise;
        live--;
        return i;
      }),
    );
    await Promise.resolve();
    expect(limiter.running).toBe(2);
    expect(limiter.queued).toBe(3);
    for (const g of gates) g.resolve();
    expect(await Promise.all(runs)).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(limiter.running).toBe(0);
    expect(limiter.queued).toBe(0);
  });

  it('refuses at once, without running the task, when the queue is full', async () => {
    const limiter = new ConcurrencyLimiter(1, 2, 60_000);
    const gate = deferred();
    const held = [0, 1, 2].map(() => limiter.run(() => gate.promise));
    const task = vi.fn(async () => undefined);
    const refused = limiter.run(task);
    await expect(refused).rejects.toBeInstanceOf(PasswordHashingBusyError);
    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    expect(task).not.toHaveBeenCalled();
    expect(limiter.queued).toBe(2);
    gate.resolve();
    await Promise.all(held);
    expect(limiter.running).toBe(0);
  });

  it('gives up on a wait longer than the timeout, and the slot stays usable', async () => {
    vi.useFakeTimers();
    const limiter = new ConcurrencyLimiter(1, 5, 1_000);
    const gate = deferred();
    const held = limiter.run(() => gate.promise);
    const task = vi.fn(async () => 'late');
    const waiting = limiter.run(task);
    const assertion = expect(waiting).rejects.toBeInstanceOf(PasswordHashingBusyError);
    await vi.advanceTimersByTimeAsync(1_001);
    await assertion;
    expect(task).not.toHaveBeenCalled();
    expect(limiter.queued).toBe(0);
    gate.resolve();
    await held;
    expect(await limiter.run(async () => 'next')).toBe('next');
    expect(limiter.running).toBe(0);
  });

  it('frees the slot when a task throws', async () => {
    const limiter = new ConcurrencyLimiter(1, 0, 1_000);
    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await limiter.run(async () => 1)).toBe(1);
  });

  it('rejects nonsensical bounds', () => {
    expect(() => new ConcurrencyLimiter(0, 1, 1)).toThrow(RangeError);
    expect(() => new ConcurrencyLimiter(1, -1, 1)).toThrow(RangeError);
    for (const timeout of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31]) {
      expect(() => new ConcurrencyLimiter(1, 1, timeout)).toThrow(RangeError);
    }
  });
});

describe('argon2 limiter wiring', () => {
  it('hashPassword and verifyPassword go through the shared limiter', async () => {
    const gate = deferred();
    const held = Array.from({ length: ARGON2_MAX_CONCURRENCY + ARGON2_MAX_QUEUE }, () =>
      argon2Limiter.run(() => gate.promise),
    );
    try {
      await expect(hashPassword('some-password-12')).rejects.toBeInstanceOf(PasswordHashingBusyError);
      await expect(verifyPassword('$argon2id$x', 'some-password-12')).rejects.toBeInstanceOf(
        PasswordHashingBusyError,
      );
      await expect(
        verifyThenHash('$argon2id$x', 'some-password-12', 'next-password-12'),
      ).rejects.toBeInstanceOf(PasswordHashingBusyError);
    } finally {
      gate.resolve();
      await Promise.all(held);
    }
    const hash = await hashPassword('some-password-12');
    expect(await verifyPassword(hash, 'some-password-12')).toBe(true);
  });

  it('verifyThenHash hashes the new password only when the current one matches', async () => {
    const hash = await hashPassword('some-password-12');
    expect(await verifyThenHash(hash, 'wrong-password-12', 'next-password-12')).toBeNull();
    const next = await verifyThenHash(hash, 'some-password-12', 'next-password-12');
    expect(next).not.toBeNull();
    expect(await verifyPassword(next!, 'next-password-12')).toBe(true);
    expect(argon2Limiter.running).toBe(0);
  }, 30_000);
});
