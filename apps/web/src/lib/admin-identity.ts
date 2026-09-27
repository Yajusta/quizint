// Identity of the signed-in admin, shared by the top bar and the login page.
//
// Extracted from `AdminLayout` in lot 5: `LoginPage` only needed `resetMe`, but importing it
// from the layout module pulled the whole admin shell (and its components) into the
// `/admin/login` chunk. This module depends only on the REST client.

import { z } from 'zod';

import { apiJson, ApiErrorThrown } from './api-client.ts';

const MeSchema = z.object({ admin: z.object({ id: z.string(), displayName: z.string() }) });

type Me = z.infer<typeof MeSchema>['admin'];

/**
 * Identity of the current admin as the server confirms it (`/auth/me`), resolved **once per
 * application load**: the promise is memoised at module level, so navigating from one admin page
 * to another does not re-issue the request. A failure is not memoised — the next caller retries.
 * Never rejects: `null` means unknown.
 */
let mePromise: Promise<Me | null> | null = null;

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

/** Display name for the top bar badge; `null` leaves it hidden. */
export function fetchMe(): Promise<string | null> {
  return fetchIdentity().then((me) => me?.displayName ?? null);
}

/**
 * Admin id that owns the local editor drafts. Always asked to the server, never read from the
 * memo: the memo is only reset by this tab's own login, logout or 401, so after another admin signs
 * in from a second tab (cookies are shared) it would still name the previous one and hand that
 * admin's drafts to the new one. Rejects like the REST client does, 401 included.
 */
export async function fetchMeId(): Promise<string> {
  const { admin } = await apiJson.get('/auth/me', MeSchema);
  return admin.id;
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
