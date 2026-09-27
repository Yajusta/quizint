// Unit tests of the live plugin's socket guards: pure, no app, no database.

import { describe, expect, it } from 'vitest';

import {
  ConcurrencyCap,
  clientIp,
  clientRateLimitKey,
  isAllowedOrigin,
} from '../src/modules/live/socket-guards.js';
import { allowedOrigins } from '../src/plugins/csrf.js';

describe('clientIp', () => {
  it('takes the rightmost X-Forwarded-For entry: the one the trusted proxy appended', () => {
    expect(clientIp({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }, '10.0.0.2')).toBe('203.0.113.7');
    expect(clientIp({ 'x-forwarded-for': ' 203.0.113.7 ' }, '10.0.0.2')).toBe('203.0.113.7');
    expect(clientIp({ 'x-forwarded-for': ['6.6.6.6', '1.1.1.1, 203.0.113.7'] } as never, '10.0.0.2')).toBe(
      '203.0.113.7',
    );
  });

  it('falls back to the socket address without the header', () => {
    expect(clientIp({}, '10.0.0.2')).toBe('10.0.0.2');
    expect(clientIp({ 'x-forwarded-for': '' }, '10.0.0.2')).toBe('10.0.0.2');
  });

  it('ignores the header from a public peer (a directly exposed port), like trustProxy', () => {
    expect(clientIp({ 'x-forwarded-for': '203.0.113.7' }, '198.51.100.4')).toBe('198.51.100.4');
  });
});

describe('clientRateLimitKey', () => {
  it('buckets an IPv6 client per /64 and an IPv4 one per address, behind Caddy or not', () => {
    const behindCaddy = (xff: string) => clientRateLimitKey({ 'x-forwarded-for': xff }, '10.0.0.2');
    expect(behindCaddy('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(behindCaddy('2001:db8:1:2:dead:beef::9')).toBe('2001:db8:1:2::/64');
    expect(behindCaddy('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
    expect(behindCaddy('203.0.113.7')).toBe('203.0.113.7');
    expect(clientRateLimitKey({}, '2001:db8:9:9::5')).toBe('2001:db8:9:9::/64');
    expect(clientRateLimitKey({}, '::ffff:203.0.113.7')).toBe('203.0.113.7');
  });
});

describe('isAllowedOrigin', () => {
  const origins = allowedOrigins('https://quiz.example.org', true);

  it('accepts the app origin and a client sending no Origin at all', () => {
    expect(isAllowedOrigin('https://quiz.example.org', origins)).toBe(true);
    expect(isAllowedOrigin(undefined, origins)).toBe(true);
    expect(
      isAllowedOrigin('https://quiz.example.org', allowedOrigins('https://quiz.example.org/some/path', true)),
    ).toBe(true);
  });

  it('refuses any other origin, same-site siblings included', () => {
    for (const origin of [
      'https://evil.example.org',
      'http://quiz.example.org',
      'https://quiz.example.org:8443',
      'null',
      '',
      'not a url',
    ]) {
      expect(isAllowedOrigin(origin, origins)).toBe(false);
    }
  });

  it('folds the loopback aliases together outside production, but keeps the port', () => {
    const dev = allowedOrigins('http://localhost:5173', false);
    expect(isAllowedOrigin('http://127.0.0.1:5173', dev)).toBe(true);
    expect(isAllowedOrigin('http://[::1]:5173', dev)).toBe(true);
    expect(isAllowedOrigin('http://localhost:8081', dev)).toBe(false);
    expect(isAllowedOrigin('http://127.0.0.1:5173', allowedOrigins('http://localhost:5173', true))).toBe(
      false,
    );
  });
});

describe('ConcurrencyCap', () => {
  it('refuses past the cap and frees a slot once per release', () => {
    const cap = new ConcurrencyCap(2);
    const a = cap.acquire('ip');
    const b = cap.acquire('ip');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(cap.acquire('ip')).toBeNull();
    expect(cap.acquire('other')).not.toBeNull();
    a!();
    a!(); // idempotent: a double release must not free someone else's slot
    expect(cap.held('ip')).toBe(1);
    expect(cap.acquire('ip')).not.toBeNull();
    expect(cap.acquire('ip')).toBeNull();
  });
});
