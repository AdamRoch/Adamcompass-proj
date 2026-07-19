import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Playwright starts webServer BEFORE globalSetup runs, so the fresh-DB reset + migration
// must live inside the webServer command chain, not in a globalSetup hook.
const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.ts'],
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: process.env.COMPASS_BASE_URL ?? 'http://localhost:3200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command:
          'rm -f data/e2e.db data/e2e.db-shm data/e2e.db-wal data/e2e.db-journal' +
          ' && pnpm --filter @compass/db migrate' +
          ' && pnpm --filter @compass/web build' +
          ' && pnpm --filter @compass/web exec next start -p 3200',
        // Dedicated port — dev machines often have another app parked on 3000, and
        // reuseExistingServer would silently run the suite against it.
        url: 'http://localhost:3200',
        timeout: 300_000,
        reuseExistingServer: false,
        env: {
          PORT: '3200',
          COMPASS_BOOTSTRAP_ALLOW_FIRST_USER: '1',
          COMPASS_DB_DIALECT: 'sqlite',
          // Anchored to the repo root for every process (migrate runs from packages/db,
          // next runs from apps/web) via COMPASS_PROJECT_ROOT.
          COMPASS_SQLITE_PATH: './data/e2e.db',
          COMPASS_PROJECT_ROOT: ROOT,
          COMPASS_SESSION_SECRET: 'e2e-session-secret-32chars-cccccc',
          COMPASS_WEBHOOK_HMAC_SECRET: 'e2e-hmac-secret-32chars-dddddddd',
          COMPASS_TOKEN_PEPPER: 'e2e-token-pepper-32chars-eeeeeee',
          COMPASS_BASE_URL: 'http://localhost:3200',
        },
      },
});
