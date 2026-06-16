import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config (Session 16a, Block 6) — SCAFFOLD.
 *
 * The 5 happy-path specs in `e2e/` are written against the real routes but are
 * NOT wired into the unit/integration quality-gate: they need the full stack
 * (web :3000 + api :3001 + Postgres/Redis) and a seeded E2E database, plus the
 * browser binaries (`pnpm exec playwright install`). They run in the dedicated
 * `e2e` CI job on `main` only (see `.github/workflows/ci.yml`).
 *
 * Enable the local stack by setting PLAYWRIGHT_WEB_SERVER=1 (starts `pnpm dev`).
 */
export default defineConfig({
  testDir: './e2e',
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: process.env.PLAYWRIGHT_WEB_SERVER
    ? {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
