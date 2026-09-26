// Socket-level guards of the live plugin (§6.7): rate buckets, concurrency caps, client IP and
// handshake Origin. No socket.io server state here, so each one is unit-testable on its own.

import type { IncomingHttpHeaders } from 'node:http';

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
 * Client IP behind exactly one trusted proxy (Caddy, like `trustProxy: 1`): the RIGHTMOST
 * X-Forwarded-For entry is the address Caddy saw. Anything left of it came from the client and
 * is spoofable. Without the header, the socket's own address.
 */
export function clientIp(headers: IncomingHttpHeaders, address: string): string {
  const forwarded = headers['x-forwarded-for'];
  const last = (Array.isArray(forwarded) ? forwarded.at(-1) : forwarded)?.split(',').at(-1)?.trim();
  return last || address;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `origin` of a URL with the loopback aliases folded together (dev opens either one). */
function normalisedOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    if (LOOPBACK.has(u.hostname)) u.hostname = 'localhost';
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * socket.io handshake Origin check (cookie-authenticated /presenter, same-site cross-origin pages).
 * A browser always sends `Origin` on a WebSocket upgrade and on a CORS polling request: when present,
 * it must be the app's own origin (PUBLIC_URL). No header at all is a non-browser client (the smoke
 * scripts, the tests, a native client) which carries no ambient cookie to abuse, so it passes.
 * The `cors` option alone would not do: socket.io does not apply it to the WebSocket upgrade.
 */
export function isAllowedOrigin(origin: string | undefined, publicUrl: string): boolean {
  if (origin === undefined) return true;
  const expected = normalisedOrigin(publicUrl);
  return expected !== null && normalisedOrigin(origin) === expected;
}
