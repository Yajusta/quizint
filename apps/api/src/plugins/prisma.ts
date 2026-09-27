// Prisma plugin — a single shared client on the Fastify instance (no encapsulation).

import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

import type { PrismaClient as PrismaClientType } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClientType;
  }
}

// SQLite tuning. journal_mode is persisted in the database file; synchronous and
// busy_timeout are per-connection, which is why DATABASE_URL pins the pool to a single
// connection (?connection_limit=1) — that also serialises writes and keeps SQLITE_BUSY
// out of the picture under the answer bursts of a live session.
const PRAGMAS = ['PRAGMA journal_mode = WAL', 'PRAGMA synchronous = NORMAL', 'PRAGMA busy_timeout = 5000'];

/**
 * Options for an interactive `$transaction` on a request path. maxWait matches the pool timeout of a
 * plain query: on the single connection a busy live session must delay the transaction, not fail it
 * after Prisma's default 2 s.
 */
export const REQUEST_TX_OPTIONS = { maxWait: 10_000 } as const;

export const prismaPlugin = fp(
  async (app: FastifyInstance) => {
    const prisma = new PrismaClient();
    await prisma.$connect();
    for (const pragma of PRAGMAS) await prisma.$queryRawUnsafe(pragma);
    app.decorate('prisma', prisma);

    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma' },
);
