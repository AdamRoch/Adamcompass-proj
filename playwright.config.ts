import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.ts'],
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: process.env.COMPASS_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @compass/web build && pnpm --filter @compass/web start',
        url: 'http://localhost:3000',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          COMPASS_DB_DIALECT: 'sqlite',
          COMPASS_SQLITE_PATH: './data/e2e.db',
          COMPASS_SESSION_SECRET: 'e2e-session-secret-32chars-cccccc',
          COMPASS_WEBHOOK_HMAC_SECRET: 'e2e-hmac-secret-32chars-dddddddd',
          COMPASS_TOKEN_PEPPER: 'e2e-token-pepper-32chars-eeeeeee',
          COMPASS_BASE_URL: 'http://localhost:3000',
        },
      },
});
