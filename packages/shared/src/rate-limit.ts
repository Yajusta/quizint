// Rate-limit rules: which bucket a client address falls in, and the per-account login failure window.
// No `node:net` here, the package stays free of Node imports: IPv6 parsing and RFC 5952 formatting go
// through the WHATWG `URL` host parser, a global in Node and in browsers alike.

import {
  LOGIN_FAILURES_PER_ACCOUNT,
  LOGIN_FAILURE_WINDOW_MS,
  RATE_LIMIT_IPV6_PREFIX_LENGTH,
} from './constants.js';

/** An IPv6 address in RFC 5952 form (lower case, no leading zeros, longest zero run as `::`), or null. */
function canonicalIpv6(address: string): string | null {
  try {
    return new URL(`http://[${address}]`).hostname.slice(1, -1);
  } catch {
    return null;
  }
}

/**
 * The eight 16-bit groups of an IPv6 address, or null: case-insensitive, `::` compression, a zone id
 * (`%eth0`) dropped, a dotted IPv4 tail (`::ffff:1.2.3.4`) folded into the last two groups. The
 * character check keeps the URL parser from silently dropping a tab or a line break.
 */
function parseIpv6(input: string): number[] | null {
  const address = input.replace(/%.*$/s, '');
  if (!/^[\d.:a-f]*:[\d.:a-f]*$/i.test(address)) return null;
  const canonical = canonicalIpv6(address);
  if (canonical === null) return null;
  const [head = '', tail] = canonical.split('::');
  const groups = (part: string) => (part === '' ? [] : part.split(':').map((g) => parseInt(g, 16)));
  const left = groups(head);
  const right = tail === undefined ? [] : groups(tail);
  return [...left, ...Array<number>(8 - left.length - right.length).fill(0), ...right];
}

/**
 * The key a per-address rate limit counts a client under.
 * - IPv4: the address itself, unchanged.
 * - IPv4-mapped IPv6 (`::ffff:1.2.3.4`, or its hex form `::ffff:102:304`): the IPv4 it maps, so a
 *   dual-stack socket and a plain IPv4 one share a bucket.
 * - Any other IPv6: its `prefixLength` network in canonical form (`2001:db8:1:2::/64`), so a client
 *   holding a whole /64 cannot get a fresh bucket per address by rotating through it.
 * - Anything unparsable: returned as-is (its own bucket, never a shared catch-all).
 */
export function rateLimitKey(ip: string, prefixLength: number = RATE_LIMIT_IPV6_PREFIX_LENGTH): string {
  const groups = parseIpv6(ip);
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const [hi = 0, lo = 0] = groups.slice(6);
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
  }
  const bits = Math.min(128, Math.max(0, Math.trunc(prefixLength)));
  const network = groups.map((g, i) => {
    const kept = Math.min(16, Math.max(0, bits - 16 * i));
    return (g & (0xffff << (16 - kept))).toString(16);
  });
  return `${canonicalIpv6(network.join(':'))}/${bits}`;
}

// --- Per-account login failures ----------------------------------------------------------------

/** Failed login attempts on one account, in a fixed window opened by the first of them. */
export interface LoginFailureWindow {
  readonly failures: number;
  /** Epoch ms at which the window closes and the account starts afresh. */
  readonly endsAt: number;
}

/** True while `entry` is open. A closed one counts as no failure at all. */
export function isLoginFailureWindowOpen(
  entry: LoginFailureWindow | undefined,
  now: number,
): entry is LoginFailureWindow {
  return entry !== undefined && now < entry.endsAt;
}

/**
 * Whole seconds (at least 1, for a `Retry-After` header) until the account may try again when it has
 * spent its budget, null when it may try now.
 */
export function loginThrottledFor(
  entry: LoginFailureWindow | undefined,
  now: number,
  maxFailures: number = LOGIN_FAILURES_PER_ACCOUNT,
): number | null {
  if (!isLoginFailureWindowOpen(entry, now) || entry.failures < maxFailures) return null;
  return Math.max(1, Math.ceil((entry.endsAt - now) / 1000));
}

/** The window after one more failure: opens a fresh one when none is open, never moves its end. */
export function countLoginFailure(
  entry: LoginFailureWindow | undefined,
  now: number,
  windowMs: number = LOGIN_FAILURE_WINDOW_MS,
): LoginFailureWindow {
  if (!isLoginFailureWindowOpen(entry, now)) return { failures: 1, endsAt: now + windowMs };
  return { failures: entry.failures + 1, endsAt: entry.endsAt };
}
