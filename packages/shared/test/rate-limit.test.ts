import { describe, expect, it } from 'vitest';

import {
  LOGIN_DELAY_BASE_MS,
  LOGIN_DELAY_MAX_MS,
  LOGIN_FAILURE_RESET_MS,
  LOGIN_FREE_FAILURES,
  RATE_LIMIT_IPV6_PREFIX_LENGTH,
  claimLoginAttempt,
  hasLoginThrottleLapsed,
  isLoginDelayed,
  loginDelayMs,
  loginRetryAfterMs,
  rateLimitKey,
  releaseLoginAttempt,
  retryAfterSeconds,
  settleLoginFailure,
  type LoginThrottleState,
} from '../src/index.js';

describe('rateLimitKey', () => {
  it('keys IPv6 on a /64 by default', () => {
    expect(RATE_LIMIT_IPV6_PREFIX_LENGTH).toBe(64);
  });

  it('leaves IPv4 unchanged', () => {
    for (const ip of ['1.2.3.4', '0.0.0.0', '255.255.255.255', '203.0.113.7', '127.0.0.1']) {
      expect(rateLimitKey(ip)).toBe(ip);
    }
  });

  it('folds IPv4-mapped IPv6 onto the IPv4, dotted or hex, any case', () => {
    expect(rateLimitKey('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(rateLimitKey('::FFFF:203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitKey('::ffff:102:304')).toBe('1.2.3.4');
    expect(rateLimitKey('0:0:0:0:0:ffff:cb00:7107')).toBe('203.0.113.7');
    expect(rateLimitKey('::ffff:1.2.3.4%eth0')).toBe('1.2.3.4');
  });

  it('keys every address of one /64 alike', () => {
    const key = '2001:db8:1:2::/64';
    for (const ip of [
      '2001:db8:1:2::1',
      '2001:db8:1:2:ffff:ffff:ffff:ffff',
      '2001:0db8:0001:0002:0000:0000:0000:0001',
      '2001:DB8:1:2:A:B:C:D',
      '2001:db8:1:2::1%eth0',
      '2001:db8:1:2:0:0:1.2.3.4',
      '2001:db8:1:2::1.2.3.4',
    ]) {
      expect(rateLimitKey(ip)).toBe(key);
    }
  });

  it('keeps distinct /64s apart', () => {
    expect(rateLimitKey('2001:db8:1:2::1')).not.toBe(rateLimitKey('2001:db8:1:3::1'));
    expect(rateLimitKey('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
  });

  it('writes the prefix in RFC 5952 form', () => {
    expect(rateLimitKey('2001:db8::1')).toBe('2001:db8::/64');
    expect(rateLimitKey('2001:0:0:1::1')).toBe('2001:0:0:1::/64');
    expect(rateLimitKey('fe80::1%lo0')).toBe('fe80::/64');
    expect(rateLimitKey('::1')).toBe('::/64');
    expect(rateLimitKey('::')).toBe('::/64');
    expect(rateLimitKey('1:2:3:4:5:6:7:8')).toBe('1:2:3:4::/64');
    expect(rateLimitKey('64:ff9b::1.2.3.4')).toBe('64:ff9b::/64');
  });

  it('honours another prefix length, bounded to 0..128', () => {
    expect(rateLimitKey('2001:db8:1:2::1', 48)).toBe('2001:db8:1::/48');
    expect(rateLimitKey('2001:db8:1:2ff::1', 56)).toBe('2001:db8:1:200::/56');
    expect(rateLimitKey('2001:db8:1:2::1', 128)).toBe('2001:db8:1:2::1/128');
    expect(rateLimitKey('2001:db8:1:2::1', 0)).toBe('::/0');
    expect(rateLimitKey('2001:db8:1:2::1', 200)).toBe('2001:db8:1:2::1/128');
    expect(rateLimitKey('2001:db8:1:2::1', -3)).toBe('::/0');
  });

  it('returns unparsable input as-is', () => {
    for (const ip of [
      '',
      'unknown',
      '1.2.3',
      '1.2.3.4.5',
      '256.1.1.1',
      '01.2.3.4',
      '1.2.3.4%eth0',
      '1:2:3:4:5:6:7',
      '1:2:3:4:5:6:7:8:9',
      '1::2::3',
      '1:::2',
      ':1::2',
      '1::2:',
      '12345::1',
      'g::1',
      '::1.2.3.4:5',
      '1.2.3.4::1',
      '1:2:3:4:5:6:7:1.2.3.4',
      '1:2:3:4:5:6:7::8',
      '[::1]',
      '2001:db8::\t1',
      '::1\n',
      'http://[::1]/',
    ]) {
      expect(rateLimitKey(ip)).toBe(ip);
    }
  });
});

describe('login delay rule', () => {
  const t0 = 1_000_000;
  /** `n` failures settled one after the other at t0: what a sequential guesser leaves behind. */
  const failed = (n: number, at = t0): LoginThrottleState => ({ failures: n, lastAt: at, inFlight: 0 });

  it('uses sensible constants: some free failures, a 1 s base, a cap well under a minute', () => {
    expect(LOGIN_FREE_FAILURES).toBeGreaterThanOrEqual(3);
    expect(LOGIN_DELAY_BASE_MS).toBe(1_000);
    expect(LOGIN_DELAY_MAX_MS).toBe(30_000);
    expect(LOGIN_FAILURE_RESET_MS).toBeGreaterThan(LOGIN_DELAY_MAX_MS);
  });

  it('costs nothing for the free failures', () => {
    for (let n = 0; n <= LOGIN_FREE_FAILURES; n++) {
      expect(loginDelayMs(n)).toBe(0);
      expect(loginRetryAfterMs(failed(n), t0)).toBe(0);
    }
  });

  it('doubles from the base with each further failure, up to the cap and no further', () => {
    const f = LOGIN_FREE_FAILURES;
    expect([1, 2, 3, 4, 5, 6, 7, 50, 5000].map((k) => loginDelayMs(f + k))).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000, 30_000,
    ]);
    expect(loginDelayMs(3, 1, 100, 250)).toBe(200);
    expect(loginDelayMs(4, 1, 100, 250)).toBe(250);
  });

  it('refuses until the delay has run from the last failure, then lets the next check start', () => {
    const s = failed(LOGIN_FREE_FAILURES + 2); // 2 s
    expect(loginRetryAfterMs(s, t0)).toBe(2_000);
    expect(loginRetryAfterMs(s, t0 + 1_999)).toBe(1);
    expect(loginRetryAfterMs(s, t0 + 2_000)).toBe(0);
    // Never longer than the cap, whatever the count.
    expect(loginRetryAfterMs(failed(10_000), t0)).toBe(LOGIN_DELAY_MAX_MS);
    expect(loginRetryAfterMs(failed(10_000), t0 + LOGIN_DELAY_MAX_MS)).toBe(0);
  });

  it('lets a single check run at a time once delayed', () => {
    // The last free failure is checked: a second attempt may still start alongside it.
    let s = claimLoginAttempt(failed(LOGIN_FREE_FAILURES - 1), t0);
    expect(loginRetryAfterMs(s, t0)).toBe(0);
    // That one is the first paid: nothing else starts until its verdict, and then the delay.
    s = claimLoginAttempt(s, t0);
    expect(s).toEqual({ failures: LOGIN_FREE_FAILURES + 1, lastAt: t0, inFlight: 2 });
    expect(loginRetryAfterMs(s, t0 + 60_000)).toBe(loginDelayMs(s.failures));
    s = settleLoginFailure(settleLoginFailure(s, t0 + 3_000), t0 + 5_000);
    expect(s.inFlight).toBe(0);
    // The delay runs from the latest verdict, not from when the check started.
    expect(loginRetryAfterMs(s, t0 + 5_000)).toBe(1_000);
    expect(loginRetryAfterMs(s, t0 + 6_000)).toBe(0);
  });

  it('counts a started check up front and opens a fresh run when none is going', () => {
    expect(claimLoginAttempt(undefined, t0)).toEqual({ failures: 1, lastAt: t0, inFlight: 1 });
    expect(claimLoginAttempt(failed(3), t0 + 10)).toEqual({ failures: 4, lastAt: t0 + 10, inFlight: 1 });
    expect(claimLoginAttempt(failed(9), t0 + LOGIN_FAILURE_RESET_MS)).toEqual({
      failures: 1,
      lastAt: t0 + LOGIN_FAILURE_RESET_MS,
      inFlight: 1,
    });
  });

  it('lapses after a quiet period, a stuck in-flight check included', () => {
    expect(hasLoginThrottleLapsed(undefined, t0)).toBe(true);
    expect(hasLoginThrottleLapsed(failed(9), t0 + LOGIN_FAILURE_RESET_MS - 1)).toBe(false);
    expect(hasLoginThrottleLapsed(failed(9), t0 + LOGIN_FAILURE_RESET_MS)).toBe(true);
    const stuck = { failures: 9, lastAt: t0, inFlight: 1 };
    expect(loginRetryAfterMs(stuck, t0 + LOGIN_FAILURE_RESET_MS - 1)).toBeGreaterThan(0);
    expect(loginRetryAfterMs(stuck, t0 + LOGIN_FAILURE_RESET_MS)).toBe(0);
    expect(hasLoginThrottleLapsed(failed(1), t0 + 5, 5)).toBe(true);
  });

  it('takes back a check that got no verdict, down to nothing', () => {
    expect(releaseLoginAttempt({ failures: 1, lastAt: t0, inFlight: 1 })).toBeUndefined();
    expect(releaseLoginAttempt({ failures: 7, lastAt: t0, inFlight: 1 })).toEqual({
      failures: 6,
      lastAt: t0,
      inFlight: 0,
    });
    expect(releaseLoginAttempt({ failures: 7, lastAt: t0, inFlight: 0 })).toEqual({
      failures: 6,
      lastAt: t0,
      inFlight: 0,
    });
  });

  it('marks an account delayed from its last free failure on', () => {
    expect(isLoginDelayed(failed(LOGIN_FREE_FAILURES - 1))).toBe(false);
    expect(isLoginDelayed(failed(LOGIN_FREE_FAILURES))).toBe(true);
    expect(isLoginDelayed(failed(LOGIN_FREE_FAILURES + 10))).toBe(true);
    // Checks in flight do not count until their verdict: they may yet be released.
    expect(isLoginDelayed({ failures: LOGIN_FREE_FAILURES, lastAt: t0, inFlight: 1 })).toBe(false);
    expect(isLoginDelayed({ failures: LOGIN_FREE_FAILURES + 1, lastAt: t0, inFlight: 1 })).toBe(true);
  });

  it('never asks for more than the delay, even with a wall clock stepped backwards', () => {
    const s = failed(LOGIN_FREE_FAILURES + 50);
    expect(loginRetryAfterMs(s, t0 - 10 * 60_000)).toBe(LOGIN_DELAY_MAX_MS);
  });

  it('a sequential guesser who always waits gets the documented schedule, capped', () => {
    let s: LoginThrottleState | undefined;
    let now = t0;
    const waits: number[] = [];
    for (let i = 0; i < LOGIN_FREE_FAILURES + 8; i++) {
      const wait = loginRetryAfterMs(s, now);
      waits.push(wait);
      now += wait;
      expect(loginRetryAfterMs(s, now)).toBe(0);
      s = settleLoginFailure(claimLoginAttempt(s, now), now);
    }
    expect(waits).toEqual([
      ...Array<number>(LOGIN_FREE_FAILURES + 1).fill(0),
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
      30_000,
    ]);
    // A success drops the state (the caller deletes it): the next attempt is free again.
    expect(loginRetryAfterMs(undefined, now)).toBe(0);
  });

  it('gives a Retry-After in whole seconds, at least 1', () => {
    expect(retryAfterSeconds(1)).toBe(1);
    expect(retryAfterSeconds(1_000)).toBe(1);
    expect(retryAfterSeconds(1_001)).toBe(2);
    expect(retryAfterSeconds(30_000)).toBe(30);
    expect(retryAfterSeconds(0)).toBe(1);
  });
});
