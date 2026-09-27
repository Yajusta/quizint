import { describe, expect, it } from 'vitest';

import { LOGIN_DELAY_MAX_MS, LOGIN_FAILURE_RESET_MS, LOGIN_FREE_FAILURES, loginDelayMs } from '@quiz/shared';

import {
  LoginThrottleTracker,
  RateLimitedError,
  rateLimitErrorResponse,
  type LoginAttempt,
  type LoginClaim,
} from '../src/lib/rate-limit.js';

function tracker(maxTracked?: number) {
  const clock = { now: 1_000_000 };
  return { clock, t: new LoginThrottleTracker(maxTracked, () => clock.now) };
}

function started(claim: LoginClaim): LoginAttempt {
  if (!claim.ok) throw new Error(`refused, retry after ${claim.retryAfter} s`);
  return claim.attempt;
}

/** `n` sequential wrong passwords on `email`, each started and failed at the current instant. */
function failTimes(t: LoginThrottleTracker, email: string, n: number) {
  for (let i = 0; i < n; i++) t.fail(started(t.claim(email)));
}

describe('LoginThrottleTracker', () => {
  it('lets the free failures through, then refuses inside the delay and lets the next check start after it', () => {
    const { clock, t } = tracker();
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES);
    // The last free one leaves no delay; the first paid one does.
    t.fail(started(t.claim('a@example.fr')));
    expect(t.claim('a@example.fr')).toEqual({ ok: false, retryAfter: 1 });
    expect(t.claim('b@example.fr').ok).toBe(true);
    clock.now += loginDelayMs(LOGIN_FREE_FAILURES + 1);
    t.fail(started(t.claim('a@example.fr')));
    expect(t.claim('a@example.fr')).toEqual({ ok: false, retryAfter: 2 });
  });

  it('never refuses for longer than the cap, however many failures', () => {
    const { clock, t } = tracker();
    for (let i = 0; i < LOGIN_FREE_FAILURES + 30; i++) {
      const claim = t.claim('a@example.fr');
      if (claim.ok) {
        t.fail(claim.attempt);
        continue;
      }
      expect(claim.retryAfter).toBeLessThanOrEqual(LOGIN_DELAY_MAX_MS / 1000);
      clock.now += claim.retryAfter * 1000;
      t.fail(started(t.claim('a@example.fr')));
    }
    expect(t.claim('a@example.fr')).toEqual({ ok: false, retryAfter: LOGIN_DELAY_MAX_MS / 1000 });
    clock.now += LOGIN_DELAY_MAX_MS;
    // The right password, once the delay has run: checked, then reset.
    started(t.claim('a@example.fr'));
    t.reset('a@example.fr');
    expect(t.size).toBe(0);
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES);
  });

  it('lets one check at a time run once delayed, claimed synchronously', () => {
    const { clock, t } = tracker();
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES - 1);
    // A burst: the last free check and the first paid one start, everything else is refused.
    const accepted = Array.from({ length: 10 }, () => t.claim('a@example.fr'))
      .filter((c) => c.ok)
      .map(started);
    expect(accepted).toHaveLength(2);
    const [first, second] = accepted;
    // However long the verdicts take, nothing else starts while one of them is out.
    clock.now += 60_000;
    expect(t.claim('a@example.fr').ok).toBe(false);
    t.fail(first!);
    expect(t.claim('a@example.fr').ok).toBe(false);
    t.fail(second!);
    // Then the delay runs from the last verdict.
    expect(t.claim('a@example.fr')).toEqual({ ok: false, retryAfter: 1 });
    clock.now += 1_000;
    expect(t.claim('a@example.fr').ok).toBe(true);
  });

  it('release gives the check back, slot and count, to its own run only', () => {
    const { clock, t } = tracker();
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES + 1);
    clock.now += LOGIN_DELAY_MAX_MS;
    const busy = started(t.claim('a@example.fr'));
    expect(t.claim('a@example.fr').ok).toBe(false);
    t.release(busy);
    // The slot is free at once (the delay runs from the last failure again, not from the refused
    // attempt), and the count is back where it was: the next failure costs 2 s, not 4 s.
    t.fail(started(t.claim('a@example.fr')));
    expect(t.claim('a@example.fr')).toEqual({ ok: false, retryAfter: 2 });

    // A lone released check leaves nothing behind.
    const { t: fresh } = tracker();
    fresh.release(started(fresh.claim('b@example.fr')));
    expect(fresh.size).toBe(0);

    // A verdict counted in a run that a success replaced lands nowhere.
    const { t: t2 } = tracker();
    const stale = started(t2.claim('c@example.fr'));
    t2.reset('c@example.fr');
    const current = started(t2.claim('c@example.fr'));
    t2.release(stale);
    t2.fail(stale);
    expect(t2.size).toBe(1);
    t2.release(current);
    expect(t2.size).toBe(0);
  });

  it('a check started before a lapse cannot touch the run that replaced it', () => {
    const { clock, t } = tracker();
    const old = started(t.claim('a@example.fr'));
    clock.now += LOGIN_FAILURE_RESET_MS;
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES + 1);
    t.release(old);
    expect(t.claim('a@example.fr')).toEqual({ ok: false, retryAfter: 1 });
  });

  it('forgets an account after a quiet period', () => {
    const { clock, t } = tracker();
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES + 1);
    expect(t.claim('a@example.fr').ok).toBe(false);
    clock.now += LOGIN_FAILURE_RESET_MS;
    // A fresh run: its failures are free again.
    failTimes(t, 'a@example.fr', LOGIN_FREE_FAILURES);
    expect(t.claim('a@example.fr').ok).toBe(true);
  });

  it('stays bounded, evicting the least recently touched entry first', () => {
    const { t } = tracker(3);
    failTimes(t, 'x1@example.fr', 1);
    failTimes(t, 'x2@example.fr', 1);
    failTimes(t, 'x3@example.fr', 1);
    // Touching x1 moves it to the back: x2 is now the oldest, and goes.
    failTimes(t, 'x1@example.fr', 1);
    failTimes(t, 'x4@example.fr', 1);
    expect(t.size).toBe(3);
    // x1 kept its two failures: the free ones run out LOGIN_FREE_FAILURES - 2 failures later.
    failTimes(t, 'x1@example.fr', LOGIN_FREE_FAILURES - 2);
    t.fail(started(t.claim('x1@example.fr')));
    expect(t.claim('x1@example.fr').ok).toBe(false);
    for (let i = 0; i < 1000; i++) failTimes(t, `flood-${i}@example.fr`, 1);
    expect(t.size).toBe(3);
  });

  it('a flood of made-up emails does not evict an account in the delayed regime', () => {
    const { t } = tracker(3);
    failTimes(t, 'target@example.fr', LOGIN_FREE_FAILURES + 1);
    // Refused from now on, so never touched again: under plain LRU it would be the first to go.
    for (let i = 0; i < 10_000; i++) failTimes(t, `flood-${i}@example.fr`, 1);
    expect(t.size).toBe(3);
    expect(t.claim('target@example.fr').ok).toBe(false);
  });

  it('claims still in flight do not buy a made-up email the protection of the delayed regime', () => {
    const { t } = tracker(3);
    failTimes(t, 'target@example.fr', LOGIN_FREE_FAILURES + 1);
    // Every free check of each made-up email started at once and never settled (to be released later).
    for (let i = 0; i < 100; i++) {
      for (let k = 0; k < LOGIN_FREE_FAILURES + 1; k++) t.claim(`flood-${i}@example.fr`);
    }
    expect(t.size).toBe(3);
    expect(t.claim('target@example.fr').ok).toBe(false);
  });

  it('evicts a delayed account only once every tracked account is delayed, oldest first', () => {
    const { t } = tracker(2);
    failTimes(t, 'd1@example.fr', LOGIN_FREE_FAILURES + 1);
    failTimes(t, 'd2@example.fr', LOGIN_FREE_FAILURES + 1);
    failTimes(t, 'x@example.fr', 1);
    expect(t.size).toBe(2);
    // d1 went: its next attempt starts a fresh run; d2 is still delayed.
    expect(t.claim('d2@example.fr').ok).toBe(false);
    expect(t.claim('d1@example.fr').ok).toBe(true);
  });

  it('evicts in constant time per write, however full the store', () => {
    // A full store of delayed accounts and a flood behind them: no flood write may scan the map.
    const max = 20_000;
    const { t } = tracker(max);
    for (let i = 0; i < max - 1; i++) failTimes(t, `d-${i}@example.fr`, LOGIN_FREE_FAILURES + 1);
    // Counted in map iteration steps, not wall-clock time (a slow machine must not fail this): every
    // Map iterator the tracker opens is wrapped so each step it takes is counted. Synchronous code
    // only between patch and restore, so nothing else iterates a Map meanwhile.
    let steps = 0;
    const proto = Map.prototype as unknown as Record<PropertyKey, (...args: unknown[]) => Iterator<unknown>>;
    const originals = new Map<PropertyKey, (...args: unknown[]) => Iterator<unknown>>();
    for (const name of ['keys', 'values', 'entries', Symbol.iterator] as const) {
      const original = proto[name]!;
      originals.set(name, original);
      proto[name] = function (this: Map<unknown, unknown>, ...args: unknown[]) {
        const it = original.apply(this, args);
        const next = it.next.bind(it);
        it.next = () => {
          steps++;
          return next();
        };
        return it;
      };
    }
    try {
      for (let i = 0; i < max; i++) failTimes(t, `flood-${i}@example.fr`, 1);
    } finally {
      for (const [name, original] of originals) proto[name] = original;
    }
    expect(t.size).toBe(max);
    expect(t.claim('d-0@example.fr').ok).toBe(false);
    // A scan of the delayed entries per write would take 20,000 steps a write; a bounded one takes a
    // handful (about 5 today; the bound leaves room for a sweep of SWEEP_BUDGET entries per map, per put).
    expect(steps / max).toBeLessThan(40);
  });

  it('sweeps lapsed runs as it goes', () => {
    const { clock, t } = tracker();
    for (let i = 0; i < 200; i++) failTimes(t, `old-${i}@example.fr`, 1);
    clock.now += LOGIN_FAILURE_RESET_MS;
    for (let i = 0; i < 56; i++) failTimes(t, `new-${i}@example.fr`, 1);
    expect(t.size).toBe(56);
  });

  it('refuses a cap below one instead of spinning in its eviction loop', () => {
    for (const bad of [0, -1, 0.5, Number.NaN]) {
      expect(() => new LoginThrottleTracker(bad)).toThrow(RangeError);
    }
    // The smallest cap works: one entry, replaced by the next.
    const { t } = tracker(1);
    failTimes(t, 'a@example.fr', 1);
    failTimes(t, 'b@example.fr', 1);
    expect(t.size).toBe(1);
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
