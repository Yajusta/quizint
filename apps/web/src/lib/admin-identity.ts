// Identity of the signed-in admin, shared by the top bar and the login page.
//
// Extracted from `AdminLayout` in lot 5: `LoginPage` only needed `resetMe`, but importing it
// from the layout module pulled the whole admin shell (and its components) into the
// `/admin/login` chunk. This module depends only on the REST client.

import { z } from 'zod';

import { apiJson, ApiErrorThrown } from './api-client.ts';

const MeSchema = z.object({ admin: z.object({ displayName: z.string() }) });

/**
 * Display name of the current admin, resolved **once per application load**: the promise is
 * memoised at module level, so navigating from one admin page to another does not re-issue
 * the request. Never rejects — the badge simply stays hidden.
 */
let mePromise: Promise<string | null> | null = null;

export function fetchMe(): Promise<string | null> {
  mePromise ??= apiJson.get('/auth/me', MeSchema).then(
    (r) => r.admin.displayName,
    () => null,
  );
  return mePromise;
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
