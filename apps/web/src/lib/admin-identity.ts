// Identity of the signed-in admin, shared by the top bar and the login page.
//
// Extracted from `AdminLayout` in lot 5: `LoginPage` only needed `resetMe`, but importing it
// from the layout module pulled the whole admin shell (and its components) into the
// `/admin/login` chunk. This module depends only on React and the REST client.

import { useEffect, useState } from 'react';

import { z } from 'zod';

import { AdminDTO } from '@quiz/shared';

import { apiJson, ApiErrorThrown } from './api-client.ts';

// The fields of the shared `AdminDTO` this module reads, `id` kept lenient (no uuid check).
const MeSchema = z.object({
  admin: AdminDTO.pick({ displayName: true, role: true }).extend({ id: z.string() }),
});

export type Me = z.infer<typeof MeSchema>['admin'];

/**
 * Identity of the current admin as the server confirms it (`/auth/me`), resolved **once per
 * application load**: the promise is memoised at module level, so navigating from one admin page
 * to another does not re-issue the request. A failure is not memoised — the next caller retries.
 * Never rejects: `null` means unknown.
 */
let mePromise: Promise<Me | null> | null = null;
/** Mounted `useMe` hooks, told when a fresher identity replaces the memo (`primeMe`). */
const listeners = new Set<(me: Me | null) => void>();

function fetchIdentity(): Promise<Me | null> {
  if (!mePromise) {
    const pending: Promise<Me | null> = apiJson.get('/auth/me', MeSchema).then(
      (r) => r.admin,
      () => {
        if (mePromise === pending) mePromise = null;
        return null;
      },
    );
    mePromise = pending;
  }
  return mePromise;
}

/**
 * Memoised identity for the top bar (name badge, role-dependent navigation): `undefined` while it
 * loads, `null` when unknown. Purely informative — the server enforces every role on its own, and a
 * 401 redirect stays each page's business. Re-renders when a page primes a fresher identity.
 */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const update = (next: Me | null) => {
      if (alive) setMe(next);
    };
    listeners.add(update);
    // Dropped if `primeMe` replaced the memo while this request ran: its identity is the fresher one,
    // already handed to `update`.
    const request = fetchIdentity();
    void request.then((next) => {
      if (mePromise === request || mePromise === null) update(next);
    });
    return () => {
      alive = false;
      listeners.delete(update);
    };
  }, []);
  return me;
}

/**
 * Identity asked to the server, never read from the memo: the memo is only reset by this tab's own
 * login, logout or 401, so after another admin signs in from a second tab (cookies are shared), or
 * after a role change, it would still describe the previous state. Rejects like the REST client
 * does, 401 included.
 */
export async function fetchFreshMe(): Promise<Me> {
  const { admin } = await apiJson.get('/auth/me', MeSchema);
  return admin;
}

/** Admin id that owns the local editor drafts (see `fetchFreshMe` for why it skips the memo). */
export async function fetchMeId(): Promise<string> {
  return (await fetchFreshMe()).id;
}

/** Replaces the memo with an identity just read from the server and updates the mounted hooks. */
export function primeMe(me: Me): void {
  mePromise = Promise.resolve(me);
  for (const listener of listeners) listener(me);
}

/**
 * Clears the identity cache. Call it whenever the session changes hands — logout, successful
 * login, 401 — otherwise the top bar would show the previous account's name after signing
 * back in under another identifier.
 */
export function resetMe(): void {
  mePromise = null;
}

/**
 * Common rule of the admin pages: an expired session (401 after the REST client's refresh
 * attempt) clears the identity and sends back to the login. Returns `true` if the error was handled.
 */
export function redirectIfUnauthorized(e: unknown, navigate: (to: string) => void): boolean {
  if (!(e instanceof ApiErrorThrown) || e.status !== 401) return false;
  resetMe();
  navigate('/admin/login');
  return true;
}
