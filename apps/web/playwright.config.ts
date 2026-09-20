import { defineConfig, devices } from '@playwright/test';

// Screenshot harness of the visual protocol (plan § 11). No automatic webServer:
// both servers are started by hand (`pnpm mock:live` + `MOCK=1 pnpm --filter @quiz/web dev`),
// which allows driving the mock's phases during the capture session.
export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    // The harness documents the French screens and selects by their wording. Without this the
    // browser would report `en-US`, the app would detect English and every selector would miss.
    // Set E2E_LOCALE=en to capture the English UI instead.
    locale: process.env.E2E_LOCALE ?? 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
