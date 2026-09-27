// Rate-limit rules: which bucket a client address falls in, and the per-account login delay.
// No `node:net` here, the package stays free of Node imports: IPv6 parsing and RFC 5952 formatting go
// through the WHATWG `URL` host parser, a global in Node and in browsers alike.

import {
  LOGIN_DELAY_BASE_MS,
  LOGIN_DELAY_MAX_MS,
  LOGIN_FAILURE_RESET_MS,
  LOGIN_FREE_FAILURES,
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

// --- Per-account login delay (see LOGIN_FREE_FAILURES) -------------------------------------------

/**
 * One account's current run of failed logins. An attempt is counted when its check starts (so a
 * burst of parallel attempts cannot all pass the delay while their hashes run) and settled when the
 * verdict lands: a failure keeps the count and restarts the delay from the verdict, a success drops
 * the whole state, a check that never got a verdict (server fault, saturated Argon2) is taken back.
 */
export interface LoginThrottleState {
  /** Attempts counted in this run: failures, plus the checks still in flight. */
  readonly failures: number;
  /** Epoch ms of the latest attempt started or failure verdict: the delay and the lapse run from it. */
  readonly lastAt: number;
  /** Checks started and not settled yet. */
  readonly inFlight: number;
}

/** The wait `failures` counted failures impose before the next check: 0 while some are still free. */
export function loginDelayMs(
  failures: number,
  free: number = LOGIN_FREE_FAILURES,
  baseMs: number = LOGIN_DELAY_BASE_MS,
  maxMs: number = LOGIN_DELAY_MAX_MS,
): number {
  if (failures <= free) return 0;
  return Math.min(baseMs * 2 ** (failures - free - 1), maxMs);
}

/**
 * True once the account has spent its free failures on settled verdicts: the next one starts (or
 * keeps) the delay. Checks still in flight do not count — they may yet be taken back, and a burst
 * of claims that are later released must not buy an entry the eviction protection of a real one.
 */
export function isLoginDelayed(state: LoginThrottleState, free: number = LOGIN_FREE_FAILURES): boolean {
  return state.failures - state.inFlight >= free;
}

/**
 * True when there is no run to speak of: none at all, or none touched for `resetMs`. A check in
 * flight that long never settled (it would have within seconds), so it does not keep the run alive.
 */
export function hasLoginThrottleLapsed(
  state: LoginThrottleState | undefined,
  now: number,
  resetMs: number = LOGIN_FAILURE_RESET_MS,
): state is undefined {
  return state === undefined || now - state.lastAt >= resetMs;
}

/**
 * Milliseconds before the account may start a check, 0 when it may start one now. In the delayed
 * regime a check already in flight holds the account: only one runs at a time, and the wait asked
 * is a full delay, the least a failure verdict will impose.
 */
export function loginRetryAfterMs(state: LoginThrottleState | undefined, now: number): number {
  if (hasLoginThrottleLapsed(state, now)) return 0;
  const delay = loginDelayMs(state.failures);
  if (delay === 0) return 0;
  if (state.inFlight > 0) return delay;
  // Clamped to the delay: a wall clock stepped backwards (NTP, VM resume) never stretches the wait.
  return Math.min(delay, Math.max(0, state.lastAt + delay - now));
}

/** Whole seconds for a Retry-After header: at least 1. */
export function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/** The state once a check starts: counted up front, as a failure until its verdict says otherwise. */
export function claimLoginAttempt(state: LoginThrottleState | undefined, now: number): LoginThrottleState {
  if (hasLoginThrottleLapsed(state, now)) return { failures: 1, lastAt: now, inFlight: 1 };
  return { failures: state.failures + 1, lastAt: now, inFlight: state.inFlight + 1 };
}

/** The state once a started check fails: the count stays, the delay runs from the verdict. */
export function settleLoginFailure(state: LoginThrottleState, now: number): LoginThrottleState {
  return { failures: state.failures, lastAt: now, inFlight: Math.max(0, state.inFlight - 1) };
}

/**
 * The state once a started check is taken back (no verdict: a fault, a saturated Argon2 limiter),
 * undefined when nothing is left. `restoreLastAt` is the `lastAt` the claim replaced, passed when
 * nothing touched the state since: the delay then runs from the last failure again, as if the
 * refused attempt never happened. Without it `lastAt` stays where the claim put it, and at worst
 * the next check waits one delay from the refused attempt (bounded by LOGIN_DELAY_MAX_MS).
 */
export function releaseLoginAttempt(
  state: LoginThrottleState,
  restoreLastAt?: number,
): LoginThrottleState | undefined {
  const failures = state.failures - 1;
  const inFlight = Math.max(0, state.inFlight - 1);
  if (failures <= 0 && inFlight === 0) return undefined;
  return { failures: Math.max(0, failures), lastAt: restoreLastAt ?? state.lastAt, inFlight };
}
