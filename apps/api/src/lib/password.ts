// Argon2id password hashing (§10) — shared by the auth routes and the seed script.

import { hash as argonHash, verify as argonVerify } from 'argon2';

export const ARGON_OPTS = { memoryCost: 65536, timeCost: 3 } as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argonVerify(hash, password);
}
