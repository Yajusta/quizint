// Socket-level guards of the live plugin (§6.7): rate buckets, concurrency caps, client IP and
// handshake Origin. No socket.io server state here, so each one is unit-testable on its own.

import type { IncomingHttpHeaders } from 'node:http';

import { rateLimitKey } from '@quiz/shared';

import { trustCaddyHop } from '../../lib/proxy.js';

/** Simple token bucket keyed by socket id or client IP (§6.7). */
export class SocketLimiter {
  private counts = new Map<string, { n: number; resetAt: number }>();
  private takes = 0;
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}
  take(key: string, max = this.max): boolean {
    const nowMs = Date.now();
    // IP-keyed buckets are never released: sweep the expired ones now and then.
    if (++this.takes % 256 === 0) {
      for (const [k, b] of this.counts) if (b.resetAt < nowMs) this.counts.delete(k);
    }
    const bucket = this.counts.get(key);
    if (!bucket || bucket.resetAt < nowMs) {
      this.counts.set(key, { n: 1, resetAt: nowMs + this.windowMs });
      return true;
    }
    if (bucket.n >= max) return false;
    bucket.n += 1;
    return true;
  }
  /** Drops a socket's bucket on disconnect: keys are socket ids, never reused, so the map
   *  would otherwise grow by one entry per socket for the life of the process. */
  release(key: string): void {
    this.counts.delete(key);
  }
}

/** Concurrent holders per key (client IP): `acquire` reserves a slot, the returned release frees it once. */
export class ConcurrencyCap {
  private readonly counts = new Map<string, number>();
  constructor(private readonly max: number) {}

  /** A release function (idempotent), or null when `key` already holds `max` slots. */
  acquire(key: string): (() => void) | null {
    const n = this.counts.get(key) ?? 0;
    if (n >= this.max) return null;
    this.counts.set(key, n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (this.counts.get(key) ?? 1) - 1;
      if (left > 0) this.counts.set(key, left);
      else this.counts.delete(key);
    };
  }

  held(key: string): number {
    return this.counts.get(key) ?? 0;
  }
}

/**
 * Client IP by the same rule as REST (`trustCaddyHop`, Fastify's `trustProxy`): behind a private
 * peer (Caddy), the RIGHTMOST X-Forwarded-For entry is the address Caddy saw — anything left of it
 * came from the client and is spoofable. A public peer (a directly exposed port) or no header at
 * all: the socket's own address.
 */
export function clientIp(headers: IncomingHttpHeaders, address: string): string {
  if (!trustCaddyHop(address, 0)) return address;
  const forwarded = headers['x-forwarded-for'];
  const last = (Array.isArray(forwarded) ? forwarded.at(-1) : forwarded)?.split(',').at(-1)?.trim();
  return last || address;
}

/**
 * The key every per-IP socket guard counts a client under: `clientIp` bucketed like REST's
 * (`rateLimitKey`: IPv4 as is, an IPv6 client per /64), so rotating addresses inside one /64 does
 * not open fresh handshake, join or open-socket budgets.
 */
export function clientRateLimitKey(headers: IncomingHttpHeaders, address: string): string {
  return rateLimitKey(clientIp(headers, address));
}

/**
 * socket.io handshake Origin check (cookie-authenticated /presenter, same-site cross-origin pages).
 * A browser always sends `Origin` on a WebSocket upgrade and on a CORS polling request: when present,
 * it must be one of `origins` — the CSRF guard's own set (`allowedOrigins`), so REST and sockets
 * accept exactly the same pages. No header at all is a non-browser client (the smoke scripts, the
 * tests, a native client) which carries no ambient cookie to abuse, so it passes.
 * The `cors` option alone would not do: socket.io does not apply it to the WebSocket upgrade.
 */
export function isAllowedOrigin(origin: string | undefined, origins: ReadonlySet<string>): boolean {
  return origin === undefined || origins.has(origin);
}
