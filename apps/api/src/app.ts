// Fastify app builder (no listen) — testable via fastify.inject().

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { API_REQUESTS_PER_MINUTE } from '@quiz/shared';

import { devJwtSecretWarning, getConfig, isDevOrTestEnv } from './config.js';
import { apiError } from './lib/api.js';
import { LogThrottle } from './lib/log-throttle.js';
import { PasswordHashingBusyError } from './lib/password.js';
import { trustCaddyHop } from './lib/proxy.js';
import { RateLimitedError, rateLimitErrorResponse, rateLimitKeyGenerator } from './lib/rate-limit.js';
import { authPlugin } from './plugins/auth.js';
import { csrfGuard } from './plugins/csrf.js';
import { prismaPlugin } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { quizRoutes } from './modules/quizzes/routes.js';
import { mediaRoutes, uploadsStaticPlugin } from './modules/media/routes.js';
import { sessionRoutes } from './modules/sessions/routes.js';
import { livePlugin } from './plugins/live.js';

/** At most one "argon2 limiter saturated" warning per interval, with the count of those dropped. */
const ARGON2_BUSY_LOG_INTERVAL_MS = 10_000;

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();
  const app = Fastify({
    // Production sits behind Caddy (deploy/Caddyfile) and the API port is never published:
    // without this, @fastify/rate-limit keys every client on the proxy's IP and all the
    // per-IP buckets (login, join, global) collapse into one. See trustCaddyHop: one hop, and only
    // from a private peer. (`trustProxy: 1` would not do: Fastify 5 trusts nothing for a bare hop
    // count, since it cannot validate the immediate peer.)
    trustProxy: trustCaddyHop,
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
  });

  const secretWarning = devJwtSecretWarning(config);
  if (secretWarning) app.log.warn(secretWarning);

  const argon2BusyLog = new LogThrottle(ARGON2_BUSY_LOG_INTERVAL_MS);
  // Set before any plugin is registered so every encapsulated context inherits it. A rate-limit
  // refusal (thrown by @fastify/rate-limit through rateLimitErrorResponse, its Retry-After header
  // already set, or by the Argon2 limiter of lib/password.ts, carrying its own) gets the standard
  // RATE_LIMITED envelope. Any other 4xx keeps Fastify's own answer (rethrown to the default
  // handler: multipart 413, bad JSON 400…); a 5xx is logged and answered with the generic INTERNAL
  // envelope, never the raw message (a Prisma error text names tables, columns and constraints).
  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error instanceof RateLimitedError) {
      // The only trace of a saturated Argon2 limiter (a login flood): nothing else logs it. Throttled,
      // or the flood it reports would write one line per refused request.
      if (error instanceof PasswordHashingBusyError) {
        const suppressed = argon2BusyLog.take();
        if (suppressed !== null) req.log.warn({ suppressed }, 'argon2 limiter saturated, request refused');
      }
      if (error.retryAfter !== undefined) reply.header('retry-after', error.retryAfter);
      return reply.status(429).send(apiError('RATE_LIMITED'));
    }
    const status = error.statusCode ?? 500;
    if (status < 500) throw error;
    req.log.error({ err: error }, 'request failed');
    return reply.status(status).send(apiError('INTERNAL'));
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  app.decorate('config', config);
  const uploadsDir = resolve(config.UPLOADS_DIR);
  mkdirSync(uploadsDir, { recursive: true });
  app.decorate('uploadsDir', uploadsDir);

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(livePlugin);

  await app.register(async (api) => {
    api.addHook('onRequest', csrfGuard(config.PUBLIC_URL, !isDevOrTestEnv(config.NODE_ENV)));
    // Keyed per client address, an IPv6 client per /64 (rateLimitKeyGenerator); every per-route
    // limit inherits the key and the RATE_LIMITED envelope unless it sets its own.
    await api.register(rateLimit, {
      global: true,
      max: API_REQUESTS_PER_MINUTE,
      timeWindow: '1 minute',
      keyGenerator: rateLimitKeyGenerator,
      errorResponseBuilder: rateLimitErrorResponse,
    });
    await api.register(authRoutes, { prefix: '/api/v1' });
    await api.register(quizRoutes, { prefix: '/api/v1' });
    await api.register(mediaRoutes, { prefix: '/api/v1' });
    await api.register(sessionRoutes, { prefix: '/api/v1' });
  });

  await app.register(uploadsStaticPlugin);
  await app.register(healthRoutes);

  return app;
}
