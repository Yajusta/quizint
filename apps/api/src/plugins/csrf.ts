// CSRF guard for the REST API: SameSite=Lax cookies alone still let a same-site page (a sibling
// subdomain) or an old browser post with the admin's cookies. Unsafe methods must come from the app's
// own origin, as the browser itself reports it.

import type { FastifyReply, FastifyRequest } from 'fastify';

import { apiError } from '../lib/api.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Origins allowed to send an unsafe request: the origin of PUBLIC_URL. Outside production, a
 * loopback PUBLIC_URL also admits its loopback aliases on the same scheme and port — Vite listens on
 * 127.0.0.1 while PUBLIC_URL defaults to http://localhost:5173, and either may sit in the address bar.
 */
export function allowedOrigins(publicUrl: string, production: boolean): Set<string> {
  const url = new URL(publicUrl);
  const origins = new Set([url.origin]);
  if (!production && LOOPBACK_HOSTS.includes(url.hostname)) {
    for (const host of LOOPBACK_HOSTS) {
      origins.add(`${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`);
    }
  }
  return origins;
}

/**
 * onRequest hook. Refused (403 FORBIDDEN) for an unsafe method when:
 * - `Sec-Fetch-Site` says `cross-site` or `same-site` (only `same-origin` and `none`, a typed URL or
 *   bookmark, pass);
 * - `Origin` is present and is not an allowed origin (browsers without Fetch Metadata still send it).
 * A request with neither header is not a browser acting on someone's behalf (curl, the smoke scripts,
 * `fastify.inject` in the tests) and passes: the cookie is what authenticates it, not a CSRF concern.
 * The Vite dev proxy forwards both headers untouched (`changeOrigin` only rewrites Host).
 */
export function csrfGuard(publicUrl: string, production: boolean) {
  const origins = allowedOrigins(publicUrl, production);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!UNSAFE_METHODS.has(req.method)) return;
    const site = req.headers['sec-fetch-site'];
    if (site === 'cross-site' || site === 'same-site') {
      return reply.status(403).send(apiError('FORBIDDEN'));
    }
    const origin = req.headers.origin;
    if (origin !== undefined && !origins.has(origin)) {
      return reply.status(403).send(apiError('FORBIDDEN'));
    }
  };
}
