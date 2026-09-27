// REST rate-limit wiring: the per-address key, the 429 envelope, and the per-account login delay
// store (the socket guards key on the same shared rateLimitKey). The rules themselves live in @quiz/shared (rate-limit.ts).

import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
// Type-only: the `createRateLimit` decorator's declaration comes with it.
import type { RateLimitOptions } from '@fastify/rate-limit';

import {
  LOGIN_FAILURE_TRACKED_ACCOUNTS_MAX,
  claimLoginAttempt,
  errorMessage,
  hasLoginThrottleLapsed,
  isLoginDelayed,
  loginRetryAfterMs,
  rateLimitKey,
  releaseLoginAttempt,
  retryAfterSeconds,
  settleLoginFailure,
  type LoginThrottleState,
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
 * A route's `config.rateLimit` counting `max` requests per minute per verified admin. It runs as a
 * preHandler, appended to the route's preHandler array after authenticate: the key is the admin that
 * authenticate verified in full, never an unverified claim, so a stolen cookie gets the same budget
 * from any IP, and a request without a valid token stops at authenticate's 401 without touching the
 * store (it cannot evict an admin's bucket from the LRU, and an expired token still gets the 401 the
 * client refreshes on, not a 429). Being a route-level config, it replaces the global per-address
 * limiter on that route: pair it with `globalAddressLimit` on onRequest. Each route-level config gets
 * its own store already (no budget is shared across routes); `scope` only prefixes the key. Since the
 * hook is pushed onto the route's preHandler array, that array must be the route's own, never one
 * shared with other routes.
 */
export const perAdminLimit = (scope: string, max: number): RateLimitOptions => ({
  hook: 'preHandler',
  max,
  timeWindow: '1 minute',
  keyGenerator: (req: FastifyRequest) => `${scope}:${req.adminId}`,
});

/** A started password check, handed back to `fail` or `release`: bound to the run it was counted in. */
export interface LoginAttempt {
  readonly key: string;
  readonly run: number;
  /** The write the claim made, and the `lastAt` it replaced: see `release`. */
  readonly write: number;
  readonly previousLastAt: number | undefined;
}

/** What `claim` answers: a check may start, or the account must wait `retryAfter` seconds. */
export type LoginClaim =
  { readonly ok: true; readonly attempt: LoginAttempt } | { readonly ok: false; readonly retryAfter: number };

interface Tracked {
  readonly state: LoginThrottleState;
  /**
   * Numbers from the tracker-wide write sequence. `run` is the write that opened this run (a verdict
   * never lands in a run a success or a lapse replaced), `write` the one that left this state (tells
   * whether anything touched it since a claim).
   */
  readonly run: number;
  readonly write: number;
}

/** Lapsed entries dropped per write, at most per map: keeps each write O(1). */
const SWEEP_BUDGET = 8;

/**
 * Per-account login delay store (in memory: a single API process, see CLAUDE.md), the rules being
 * the shared ones (LoginThrottleState). Keys are a hash of the normalised email, so a key costs the
 * same whatever the email's length.
 *
 * Bounded at `maxTracked` entries, every write a bounded number of map operations (no scan of the
 * store: a few front reads, one eviction, a sweep of at most SWEEP_BUDGET entries per map — V8 does
 * skip the deleted slots at a map's front on each of those reads, some tens of microseconds on a full
 * store, next to the Argon2 verify each accepted claim leads to). Two maps, each in least recently
 * touched order (a write re-inserts its key at the end): `fresh` for accounts still within their
 * free failures, `delayed` for the ones that spent them. Past the cap the oldest `fresh` entry goes
 * first; a `delayed` one only once `fresh` is empty — so a flood of made-up emails (all `fresh`)
 * only evicts itself and cannot wipe the delay of an account under attack, which, being refused,
 * is not touched and would be the first to go under plain LRU. Lapsed runs are treated as absent on
 * read and dropped from the front of each map a few at a time on every write.
 */
export class LoginThrottleTracker {
  private readonly fresh = new Map<string, Tracked>();
  private readonly delayed = new Map<string, Tracked>();
  private writes = 0;

  constructor(
    private readonly maxTracked: number = LOGIN_FAILURE_TRACKED_ACCOUNTS_MAX,
    // A closure, not `Date.now` itself: a clock faked after construction (tests) is then honoured.
    private readonly now: () => number = () => Date.now(),
  ) {
    // put() evicts until `size < maxTracked`: below 1 (or NaN) that never holds on an empty map,
    // and the eviction loop would spin forever.
    if (!Number.isInteger(maxTracked) || maxTracked < 1) {
      throw new RangeError(`LoginThrottleTracker maxTracked must be an integer >= 1, got ${maxTracked}`);
    }
  }

  /**
   * Asks to start a password check on `email`: refused (with the seconds to wait) while the account's
   * delay runs, or while another of its checks is in flight in the delayed regime. An accepted check
   * is counted as a failure right away, synchronously — before the caller's first await — so a
   * burst of parallel attempts cannot all pass while their hashes run; its verdict then goes to
   * `fail`, `release` or `reset`.
   */
  claim(email: string): LoginClaim {
    const key = sha256(email);
    const now = this.now();
    const tracked = this.get(key, now);
    const wait = loginRetryAfterMs(tracked?.state, now);
    if (wait > 0) return { ok: false, retryAfter: retryAfterSeconds(wait) };
    const { run, write } = this.put(key, claimLoginAttempt(tracked?.state, now), tracked?.run, now);
    return { ok: true, attempt: { key, run, write, previousLastAt: tracked?.state.lastAt } };
  }

  /** A wrong password (or an unknown or inactive account): the count stays, the delay starts now. */
  fail(attempt: LoginAttempt): void {
    const now = this.now();
    const tracked = this.current(attempt, now);
    if (tracked) this.put(attempt.key, settleLoginFailure(tracked.state, now), tracked.run, now);
  }

  /**
   * Takes back a check that never got a verdict (the lookup or the hash threw, answered 500, or the
   * saturated Argon2 limiter refused it, answered 429): neither spends the account's count. Only
   * within the run it was counted in — an attacker able to delay the refusal (a queued Argon2 wait)
   * cannot cancel failures of a run that replaced it. When nothing touched the account since the
   * claim, the delay runs from the last failure again, as if the attempt never happened.
   */
  release(attempt: LoginAttempt): void {
    const now = this.now();
    const tracked = this.current(attempt, now);
    if (!tracked) return;
    const untouched = tracked.write === attempt.write;
    const state = releaseLoginAttempt(tracked.state, untouched ? attempt.previousLastAt : undefined);
    if (state) this.put(attempt.key, state, tracked.run, now);
    else this.drop(attempt.key);
  }

  /** A successful login: the account starts afresh, checks still in flight included. */
  reset(email: string): void {
    this.drop(sha256(email));
  }

  get size(): number {
    return this.fresh.size + this.delayed.size;
  }

  private get(key: string, now: number): Tracked | undefined {
    const tracked = this.fresh.get(key) ?? this.delayed.get(key);
    if (tracked && hasLoginThrottleLapsed(tracked.state, now)) {
      this.drop(key);
      return undefined;
    }
    return tracked;
  }

  private current(attempt: LoginAttempt, now: number): Tracked | undefined {
    const tracked = this.get(attempt.key, now);
    return tracked?.run === attempt.run ? tracked : undefined;
  }

  private drop(key: string): void {
    if (!this.fresh.delete(key)) this.delayed.delete(key);
  }

  /**
   * Stores `state` as the account's latest, at the back of its map, in `run` — or in a new run this
   * write opens when undefined. Returns the entry stored.
   */
  private put(key: string, state: LoginThrottleState, run: number | undefined, now: number): Tracked {
    this.drop(key);
    this.sweep(now);
    while (this.size >= this.maxTracked) this.evictOldest();
    const write = ++this.writes;
    const tracked: Tracked = { state, run: run ?? write, write };
    (isLoginDelayed(state) ? this.delayed : this.fresh).set(key, tracked);
    return tracked;
  }

  private evictOldest(): void {
    const map = this.fresh.size > 0 ? this.fresh : this.delayed;
    const oldest = map.keys().next();
    if (!oldest.done) map.delete(oldest.value);
  }

  /** Drops lapsed runs from the front (least recently touched end) of each map, a few per call. */
  private sweep(now: number): void {
    for (const map of [this.fresh, this.delayed]) {
      let budget = SWEEP_BUDGET;
      for (const [key, tracked] of map) {
        if (budget-- === 0 || !hasLoginThrottleLapsed(tracked.state, now)) break;
        map.delete(key);
      }
    }
  }
}
