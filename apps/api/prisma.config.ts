import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

// Prisma stops auto-loading `.env` as soon as a config file exists (it says so on every run),
// so the CLI would no longer see DATABASE_URL. Node 22 reads the file natively; variables
// already present in the environment win, which is what the dotenv loader did before.
const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: path.join(root, 'prisma', 'schema.prisma'),
});
