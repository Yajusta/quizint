// Fastify app builder (no listen) — testable via fastify.inject().

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';

import { getConfig, usesDevJwtSecret } from './config.js';
import { apiError } from './lib/api.js';
import { trustCaddyHop } from './lib/proxy.js';
import { authPlugin } from './plugins/auth.js';
import { csrfGuard } from './plugins/csrf.js';
import { prismaPlugin } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { quizRoutes } from './modules/quizzes/routes.js';
import { mediaRoutes, uploadsStaticPlugin } from './modules/media/routes.js';
import { sessionRoutes } from './modules/sessions/routes.js';
import { livePlugin } from './plugins/live.js';

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

  if (config.NODE_ENV !== 'test' && usesDevJwtSecret(config)) {
    app.log.warn(
      'JWT_SECRET is the public development secret committed in .env.example: anyone can forge admin ' +
        'tokens for this server. Set a random JWT_SECRET of at least 32 bytes before exposing it.',
    );
  }

  // Set before any plugin is registered so every encapsulated context inherits it. A 4xx keeps
  // Fastify's own answer (rethrown to the default handler: rate limit 429, multipart 413, bad JSON
  // 400…); a 5xx is logged and answered with the generic INTERNAL envelope, never the raw message
  // (a Prisma error text names tables, columns and constraints).
  app.setErrorHandler((error: FastifyError, req, reply) => {
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
    api.addHook('onRequest', csrfGuard(config.PUBLIC_URL, config.NODE_ENV === 'production'));
    await api.register(rateLimit, {
      global: true,
      max: 2000,
      timeWindow: '1 minute',
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
