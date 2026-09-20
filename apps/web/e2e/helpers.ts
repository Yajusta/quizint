// Screenshot harness of the visual protocol (plan § 11), shared by the specs of every lot.
//
// Prerequisites (§ 11.1): `pnpm mock:live` then `MOCK=1 pnpm --filter @quiz/web dev`.
// Output: docs/screens/<surface>/<state>.png at the repo root.
//
// Helpers contract:
//   VIEWPORTS  — the named viewports of § 11.2.
//   watchForErrors(page) — any page or console error fails the capture.
//   shot(page, surface, name) — full-page capture into docs/screens/<surface>/<name>.png.
//   captureRoute(...) — opens a route, waits for the render and captures.
//   settle(page, ms) — fonts loaded, then a margin to let the motion settle.
//   escapeRe(s)      — escapes a label before putting it in a RegExp.
//   MOCK_EXPECTED_ERRORS — 404s expected when the web runs against the mock.
//   api(request, …)  — authenticated REST call to the real API (admin and editor specs).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type APIRequestContext, type Page } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Repo root: apps/web/e2e → ../../.. */
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
export const SCREENS_DIR = path.join(REPO_ROOT, 'docs', 'screens');

export interface Viewport {
  width: number;
  height: number;
}

/** Reference viewports of the plan § 11.2. */
export const VIEWPORTS = {
  'participant-390': { width: 390, height: 780 },
  'participant-360': { width: 360, height: 740 },
  'participant-430': { width: 430, height: 930 },
  'stage-1920': { width: 1920, height: 1080 },
  'stage-1280': { width: 1280, height: 800 },
  'stage-1366': { width: 1366, height: 768 },
  'admin-1440': { width: 1440, height: 900 },
  'admin-1280': { width: 1280, height: 800 },
  'admin-1024': { width: 1024, height: 768 },
} as const satisfies Record<string, Viewport>;

export type ViewportName = keyof typeof VIEWPORTS;

/**
 * Attaches the error listeners. The returned array must be empty at capture time:
 * an unhandled exception or a `console.error` invalidates the screen, not only the render.
 * `ignore`: expected patterns (e.g. a deliberate 404 on /api/v1/join for the « introuvable » state).
 */
export function watchForErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  const keep = (text: string) => !ignore.some((re) => re.test(text));
  page.on('pageerror', (err) => {
    if (keep(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && keep(msg.text())) errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

/** Full-page capture into docs/screens/<surface>/<name>.png. */
export async function shot(page: Page, surface: string, name: string): Promise<string> {
  const file = path.join(SCREENS_DIR, surface, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** Opens a route, waits for the render and captures; fails on the slightest console error. */
export async function captureRoute(
  page: Page,
  surface: string,
  name: string,
  route: string,
  viewport: ViewportName,
): Promise<void> {
  const errors = watchForErrors(page);
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await shot(page, surface, `${name}-${viewport}`);
  expect(errors, `erreurs console sur ${route} (${viewport})`).toEqual([]);
}

/** Lets the motion settle (entries, CountUp, podium) before the capture. */
export async function settle(page: Page, ms = 900): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The mock does not serve /api/v1/auth/refresh: the presenter hook's 404 is expected. */
export const MOCK_EXPECTED_ERRORS = [
  /Failed to load resource.*404/,
  /the server responded with a status of 404/,
];

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.fr';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-12';

export async function api<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await request.fetch(`/api/v1${path}`, {
    method,
    headers: { 'X-Requested-With': 'fetch', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { data: body } : {}),
  });
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  return res.status() === 204 ? (undefined as T) : ((await res.json()) as T);
}
