// pretest: drop the throwaway test database and migrate it from scratch.
// DATABASE_URL is forced here (and in vitest.config.ts) so the suite never touches the dev
// database, whatever apps/api/.env holds — or whether it exists at all.

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const DATABASE_URL = 'file:../data/test.db?connection_limit=1';

for (const file of ['data/test.db', 'data/test.db-wal', 'data/test.db-shm']) {
  rmSync(file, { force: true });
}

execFileSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL },
});
