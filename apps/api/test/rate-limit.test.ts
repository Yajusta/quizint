import { describe, expect, it } from 'vitest';

import { LOGIN_FAILURES_PER_ACCOUNT, LOGIN_FAILURE_WINDOW_MS } from '@quiz/shared';

import { LoginFailureTracker, RateLimitedError, rateLimitErrorResponse } from '../src/lib/rate-limit.js';

function tracker(maxTracked?: number) {
  const clock = { now: 1_000_000 };
  return { clock, t: new LoginFailureTracker(maxTracked, () => clock.now) };
}

describe('LoginFailureTracker', () => {
  it('throttles an email once its failures are spent, until the window closes', () => {
    const { clock, t } = tracker();
    for (let i = 0; i < LOGIN_FAILURES_PER_ACCOUNT; i++) {
      expect(t.throttledFor('a@example.fr')).toBeNull();
      t.countFailure('a@example.fr');
    }
    expect(t.throttledFor('a@example.fr')).toBe(LOGIN_FAILURE_WINDOW_MS / 1000);
    expect(t.throttledFor('b@example.fr')).toBeNull();
    clock.now += LOGIN_FAILURE_WINDOW_MS - 1000;
    expect(t.throttledFor('a@example.fr')).toBe(1);
    clock.now += 1000;
    expect(t.throttledFor('a@example.fr')).toBeNull();
  });

  it('reset clears the email', () => {
    const { t } = tracker();
    for (let i = 0; i < LOGIN_FAILURES_PER_ACCOUNT; i++) t.countFailure('a@example.fr');
    t.reset('a@example.fr');
    expect(t.throttledFor('a@example.fr')).toBeNull();
    expect(t.size).toBe(0);
  });

  it('stays bounded: past the cap, the least recently counted email goes first', () => {
    const { t } = tracker(3);
    for (let i = 0; i < LOGIN_FAILURES_PER_ACCOUNT; i++) t.countFailure('hot@example.fr');
    t.countFailure('x1@example.fr');
    t.countFailure('x2@example.fr');
    // Counting moves an email to the back: the hot one survives the next insertion, x1 does not.
    t.countFailure('hot@example.fr');
    t.countFailure('x3@example.fr');
    expect(t.size).toBe(3);
    expect(t.throttledFor('hot@example.fr')).not.toBeNull();
    t.countFailure('x1@example.fr');
    // x2 was the oldest; x1 came back as a new entry with a single failure.
    expect(t.size).toBe(3);
    // A flood of new emails costs no memory past the cap (it does evict older entries).
    for (let i = 0; i < 1000; i++) t.countFailure(`flood-${i}@example.fr`);
    expect(t.size).toBe(3);
  });

  it('a flood of made-up emails does not evict a throttled account', () => {
    const { t } = tracker(3);
    for (let i = 0; i < LOGIN_FAILURES_PER_ACCOUNT; i++) t.countFailure('target@example.fr');
    // The target is refused from now on, so never counted again: it stays the oldest entry.
    for (let i = 0; i < 1000; i++) t.countFailure(`flood-${i}@example.fr`);
    expect(t.size).toBe(3);
    expect(t.throttledFor('target@example.fr')).not.toBeNull();
  });

  it('uncountFailure gives back one attempt without moving the window', () => {
    const { t } = tracker();
    for (let i = 0; i < LOGIN_FAILURES_PER_ACCOUNT; i++) t.countFailure('a@example.fr');
    t.uncountFailure('a@example.fr');
    expect(t.throttledFor('a@example.fr')).toBeNull();
    t.countFailure('a@example.fr');
    expect(t.throttledFor('a@example.fr')).not.toBeNull();
    const { t: fresh } = tracker();
    fresh.countFailure('b@example.fr');
    fresh.uncountFailure('b@example.fr');
    fresh.uncountFailure('never@example.fr');
    expect(fresh.size).toBe(0);
  });

  it('refuses a cap below one instead of spinning in its eviction loop', () => {
    for (const bad of [0, -1, 0.5, Number.NaN]) {
      expect(() => new LoginFailureTracker(bad)).toThrow(RangeError);
    }
    // The smallest cap works: one entry, replaced by the next.
    const { t } = tracker(1);
    t.countFailure('a@example.fr');
    t.countFailure('b@example.fr');
    expect(t.size).toBe(1);
  });

  it('sweeps closed windows as it goes', () => {
    const { clock, t } = tracker();
    for (let i = 0; i < 200; i++) t.countFailure(`old-${i}@example.fr`);
    clock.now += LOGIN_FAILURE_WINDOW_MS;
    for (let i = 0; i < 56; i++) t.countFailure(`new-${i}@example.fr`);
    expect(t.size).toBe(56);
  });
});

describe('rateLimitErrorResponse', () => {
  it('builds a 429 the error handler recognises', () => {
    const err = rateLimitErrorResponse();
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
  });
});
