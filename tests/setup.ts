// Vitest global setup: per-test env defaults + tmpdir cleanup hook.
//
// Most tests should still call `setupTestDb()` from `tests/helpers/db.ts` inside their own
// `beforeEach` — that helper creates the actual schema. This file only seeds env vars so anything
// reading them at module-load time doesn't fail.

import { afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDirs: string[] = [];

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'compass-test-'));
  tmpDirs.push(dir);
  process.env.COMPASS_DB_DIALECT = 'sqlite';
  process.env.COMPASS_SQLITE_PATH = join(dir, 'test.db');
  process.env.COMPASS_SESSION_SECRET = 'test-secret-32chars-aaaaaaaaaa11';
  process.env.COMPASS_WEBHOOK_HMAC_SECRET = 'test-hmac-secret-32chars-bbbbbbbb';
  process.env.COMPASS_TOKEN_PEPPER = 'test-token-pepper-32chars-ccccc1';
  process.env.COMPASS_BASE_URL = 'http://localhost:3000';
});

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});
