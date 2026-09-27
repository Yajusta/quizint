// REST rate-limit wiring: the per-address key, the 429 envelope, and the per-account login failure
// store (the socket guards key on the same shared rateLimitKey). The rules themselves live in @quiz/shared (rate-limit.ts).

import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
// Type-only: the `createRateLimit` decorator's declaration.
import type {} from '@fastify/rate-limit';

import {
  LOGIN_FAILURE_TRACKED_ACCOUNTS_MAX,
  countLoginFailure,
  errorMessage,
  isLoginFailureWindowOpen,
  loginThrottledFor,
  rateLimitKey,
  type LoginFailureWindow,
} from '@quiz/shared';

import { sha256 } from './api.js';

/**
 * @fastify/rate-limit key: the client address as `trustCaddyHop` resolved it, bucketed by
 * `rateLimitKey` (an IPv6 client counts per /64). Inherited by every per-route limit that does not
 * set its own.
 */
export const rateLimitKeyGenerator = (req: FastifyRequest): string => rateLimitKey(req.ip);

/**
 * A refusal the app's error handler answers with the standard RATE_LIMITED envelope. `retryAfter`
 * (seconds) becomes the Retry-After header when set; @fastify/rate-limit sets its own header and
 * leaves it undefined.
 */
export class RateLimitedError extends Error {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMITED';
  constructor(readonly retryAfter?: number) {
    super(errorMessage('RATE_LIMITED'));
  }
}

/**
 * @fastify/rate-limit `errorResponseBuilder`: the plugin throws what this returns, and the app's error
 * handler turns it into `{ error: { code: 'RATE_LIMITED', … } }` — the envelope the web login page
 * looks for — instead of Fastify's default error body. Route-level configs inherit it.
 */
export const rateLimitErrorResponse = (): RateLimitedError => new RateLimitedError();

/**
 * An onRequest hook drawing on the global per-address bucket (the very store and key of the global
 * limiter, API_REQUESTS_PER_MINUTE), for a route whose own `config.rateLimit` replaced it: with
 * @fastify/rate-limit, a route-level config is the route's only limiter. `createRateLimit()` without
 * options is the global limiter itself, and unlike `app.rateLimit()` it does not set the per-request
 * "already limited" flag, which would make the route's own limiter skip the request.
 * `app` must be inside the context the plugin is registered in.
 */
export function globalAddressLimit(app: FastifyInstance): onRequestAsyncHookHandler {
  const check = app.createRateLimit();
  return async (req, reply) => {
    const res = await check(req);
    if (res.isAllowed || !res.isExceeded) return;
    // The headers the global limiter sends on its own 429 (Retry-After comes from the error handler).
    // Only on the refusal: an allowed request reports the route's own limiter, which runs later.
    reply.header('x-ratelimit-limit', res.max);
    reply.header('x-ratelimit-remaining', 0);
    reply.header('x-ratelimit-reset', res.ttlInSeconds);
    throw new RateLimitedError(res.ttlInSeconds);
  };
}

/**
 * Failed login attempts per account (in memory: a single API process, see CLAUDE.md). Keys are a hash
 * of the normalised email, so a key costs the same whatever the email's length. The map is bounded:
 * expired windows are swept now and then, and past LOGIN_FAILURE_TRACKED_ACCOUNTS_MAX expired windows go first, then
 * the least recently counted entry that is not throttled (see evictOne).
 */
export class LoginFailureTracker {
  private readonly windows = new Map<string, LoginFailureWindow>();
  private writes = 0;

  constructor(
    private readonly maxTracked: number = LOGIN_FAILURE_TRACKED_ACCOUNTS_MAX,
    private readonly now: () => number = Date.now,
  ) {
    // countFailure evicts until `size < maxTracked`: below 1 (or NaN) that never holds on an empty
    // map, and the eviction loop would spin forever.
    if (!Number.isInteger(maxTracked) || maxTracked < 1) {
      throw new RangeError(`LoginFailureTracker maxTracked must be an integer >= 1, got ${maxTracked}`);
    }
  }

  private static key(email: string): string {
    return sha256(email);
  }

  /**
   * Seconds until the account may try again when its budget is spent, null when it may try now.
   * Checked before any password hashing.
   */
  throttledFor(email: string): number | null {
    return loginThrottledFor(this.windows.get(LoginFailureTracker.key(email)), this.now());
  }

  /**
   * Counts one attempt as a failure. Called BEFORE the password is verified, so a burst of parallel
   * attempts cannot all slip past the check while their hashes run; a success then calls `reset`.
   * Returns the end of the window the attempt was counted in, for `uncountFailure`.
   */
  countFailure(email: string): number {
    const key = LoginFailureTracker.key(email);
    const now = this.now();
    const next = countLoginFailure(this.windows.get(key), now);
    this.windows.delete(key);
    if (++this.writes % 256 === 0) this.sweep(now);
    if (this.windows.size >= this.maxTracked) this.sweep(now);
    while (this.windows.size >= this.maxTracked) this.evictOne(now);
    this.windows.set(key, next);
    return next.endsAt;
  }

  /**
   * Takes back the up-front count of an attempt that never got a verdict (the lookup or the hash
   * threw, answered 500, or the saturated Argon2 limiter refused it, answered 429): neither spends the
   * account's budget. `windowEndsAt` is what `countFailure` returned: an attempt counted in a window
   * that has since expired (or been reset) is not taken back from the one that replaced it — an
   * attacker able to delay the refusal (a queued Argon2 wait) would otherwise cancel real guesses.
   */
  uncountFailure(email: string, windowEndsAt: number): void {
    const key = LoginFailureTracker.key(email);
    const entry = this.windows.get(key);
    if (!entry || entry.endsAt !== windowEndsAt) return;
    if (entry.failures <= 1) this.windows.delete(key);
    else this.windows.set(key, { failures: entry.failures - 1, endsAt: entry.endsAt });
  }

  reset(email: string): void {
    this.windows.delete(LoginFailureTracker.key(email));
  }

  get size(): number {
    return this.windows.size;
  }

  /**
   * Drops the least recently counted entry that is not throttled. A throttled account is never
   * counted again while refused, so plain LRU would evict it first and a flood of made-up emails
   * would wipe its lockout; it goes only once every tracked entry is throttled.
   */
  private evictOne(now: number): void {
    let victim: string | undefined;
    for (const [k, w] of this.windows) {
      victim ??= k;
      if (loginThrottledFor(w, now) === null) {
        victim = k;
        break;
      }
    }
    if (victim !== undefined) this.windows.delete(victim);
  }

  private sweep(now: number): void {
    for (const [k, w] of this.windows) if (!isLoginFailureWindowOpen(w, now)) this.windows.delete(k);
  }
}
