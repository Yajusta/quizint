import { describe, expect, it } from 'vitest';

import {
  LOGIN_FAILURES_PER_ACCOUNT,
  LOGIN_FAILURE_WINDOW_MS,
  RATE_LIMIT_IPV6_PREFIX_LENGTH,
  countLoginFailure,
  isLoginFailureWindowOpen,
  loginThrottledFor,
  rateLimitKey,
  type LoginFailureWindow,
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

describe('login failure window', () => {
  const t0 = 1_000_000;

  it('opens a window on the first failure', () => {
    expect(countLoginFailure(undefined, t0)).toEqual({ failures: 1, endsAt: t0 + LOGIN_FAILURE_WINDOW_MS });
    expect(countLoginFailure(undefined, t0, 5000)).toEqual({ failures: 1, endsAt: t0 + 5000 });
  });

  it('counts within the window without moving its end', () => {
    let w: LoginFailureWindow | undefined;
    for (let i = 0; i < 3; i++) w = countLoginFailure(w, t0 + i * 1000);
    expect(w).toEqual({ failures: 3, endsAt: t0 + LOGIN_FAILURE_WINDOW_MS });
  });

  it('starts afresh once the window has closed', () => {
    const w = { failures: 7, endsAt: t0 };
    expect(countLoginFailure(w, t0)).toEqual({ failures: 1, endsAt: t0 + LOGIN_FAILURE_WINDOW_MS });
    expect(isLoginFailureWindowOpen(w, t0 - 1)).toBe(true);
    expect(isLoginFailureWindowOpen(w, t0)).toBe(false);
    expect(isLoginFailureWindowOpen(undefined, t0)).toBe(false);
  });

  it('throttles from the budget-th failure until the window closes', () => {
    let w: LoginFailureWindow | undefined;
    for (let i = 0; i < LOGIN_FAILURES_PER_ACCOUNT - 1; i++) {
      w = countLoginFailure(w, t0);
      expect(loginThrottledFor(w, t0)).toBeNull();
    }
    w = countLoginFailure(w, t0);
    expect(w.failures).toBe(LOGIN_FAILURES_PER_ACCOUNT);
    expect(loginThrottledFor(w, t0)).not.toBeNull();
    expect(loginThrottledFor(w, w.endsAt - 1)).not.toBeNull();
    expect(loginThrottledFor(w, w.endsAt)).toBeNull();
    expect(loginThrottledFor(undefined, t0)).toBeNull();
    expect(loginThrottledFor({ failures: 2, endsAt: t0 + 1 }, t0, 2)).not.toBeNull();
  });

  it('gives a Retry-After in whole seconds, at least 1', () => {
    expect(loginThrottledFor({ failures: 10, endsAt: t0 + 1500 }, t0)).toBe(2);
    expect(loginThrottledFor({ failures: 10, endsAt: t0 + 60_000 }, t0)).toBe(60);
    expect(loginThrottledFor({ failures: 10, endsAt: t0 + 1 }, t0)).toBe(1);
  });
});
