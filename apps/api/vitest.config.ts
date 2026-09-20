// Test environment for @quiz/api (§13): the suite must never depend on a local .env.
// `apps/api/.env` is gitignored, and importing @prisma/client happens to load it — a clone,
// a worktree, CI or the Docker build has no such file, and getConfig() then throws on
// DATABASE_URL. dotenv never overwrites a variable already set, so this stays authoritative.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      // Throwaway database recreated from scratch by the pretest script, never the dev one.
      // Prisma resolves relative SQLite paths from prisma/, so this is apps/api/data/test.db.
      DATABASE_URL: 'file:../data/test.db?connection_limit=1',
    },
  },
});
