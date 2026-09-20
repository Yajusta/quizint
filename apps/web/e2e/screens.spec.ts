// Non-regression captures (plan § 11) — the two routes that open without a live session:
// the code entry and the back-office login, each at the two reference viewports.
// This spec depends neither on the mock nor on the API: it checks that the application starts, that
// the tokens are in place and that no console error comes out. The shared helpers are in ./helpers.ts.

import { test } from '@playwright/test';

import { captureRoute, type ViewportName } from './helpers';

const ROUTES = [
  { surface: 'participant', name: 'join-code', route: '/' },
  { surface: 'admin', name: 'admin-login', route: '/admin/login' },
] as const;

const VIEWPORTS: ViewportName[] = ['participant-390', 'admin-1440'];

for (const { surface, name, route } of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`écrans de base — ${name} @ ${viewport}`, async ({ page }) => {
      await captureRoute(page, surface, name, route, viewport);
    });
  }
}
