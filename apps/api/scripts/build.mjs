// Production bundle. esbuild compiles the TypeScript entrypoints — including the
// source-only @quiz/shared workspace package, which exports .ts and emits nothing of its
// own — into plain ESM under dist/.
//
// Everything installed in node_modules stays external: several runtime dependencies ship
// native binaries or engine files (argon2, sharp, @prisma/client) that must not be inlined.
// @quiz/shared is the single deliberate exception, since there is no built copy of it.

import { readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const BUNDLED = '@quiz/shared';
const external = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].filter(
  (name) => name !== BUNDLED,
);

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'warning',
};

const outputs = [
  { entryPoints: ['src/server.ts'], outfile: 'dist/server.js' },
  { entryPoints: ['prisma/seed.ts'], outfile: 'dist/prisma-seed.js' },
];

await Promise.all(outputs.map((o) => build({ ...common, ...o })));

const missing = outputs.map((o) => o.outfile).filter((f) => !existsSync(f));
if (missing.length > 0) throw new Error(`bundle manquant : ${missing.join(', ')}`);
console.log(`bundle ok → ${outputs.map((o) => o.outfile).join(', ')}`);
