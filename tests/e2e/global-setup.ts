// Playwright global setup: delete the E2E SQLite DB so the login bootstrap creates a fresh user
// on every test run. The DB path matches playwright.config.ts → webServer.env.COMPASS_SQLITE_PATH.
//
// Running in this file (rather than as a test fixture) ensures the deletion happens BEFORE the
// webServer starts up, so we don't race the Next.js boot against a half-deleted file.

import { rmSync } from 'node:fs';

const DB_PATH = './apps/web/data/e2e.db';

export default async function globalSetup() {
  for (const suffix of ['', '-shm', '-wal', '-journal']) {
    try {
      rmSync(`${DB_PATH}${suffix}`, { force: true });
    } catch {
      // ignore
    }
  }
}
