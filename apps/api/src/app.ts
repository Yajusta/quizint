// Fastify app builder (no listen) — testable via fastify.inject().

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';

import { getConfig } from './config.js';
import { authPlugin } from './plugins/auth.js';
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
    // per-IP buckets (login, join, global) collapse into one.
    trustProxy: true,
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
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
