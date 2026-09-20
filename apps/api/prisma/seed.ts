// Idempotent seed: creates the first admin from env vars, only if the table is empty (§5.1).

import { PrismaClient } from '@prisma/client';

import { PLACEHOLDER_PASSWORDS } from '../src/config.js';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Lower-cased like login and POST /admins do before their unique lookup: a mixed-case seed
  // email would create an admin nobody can sign in as.
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping seed.');
    return;
  }
  if (process.env.NODE_ENV === 'production' && PLACEHOLDER_PASSWORDS.has(password)) {
    console.error('SEED_ADMIN_PASSWORD is the template placeholder — refusing to seed a public password.');
    process.exitCode = 1;
    return;
  }
  const count = await prisma.admin.count();
  if (count > 0) {
    console.log(`Admin table already has ${count} row(s) — skipping seed.`);
    return;
  }
  const passwordHash = await hashPassword(password);
  await prisma.admin.create({
    data: { email, passwordHash, displayName: 'Administrateur' },
  });
  console.log(`Seeded first admin: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
