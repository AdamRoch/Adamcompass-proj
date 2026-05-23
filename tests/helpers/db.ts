// Programmatic DB bootstrap for Vitest.
//
// The repo's `packages/db/src/migrate.ts` is a top-level script (calls main() on import) and
// imports `./index.js` which reads env at module-load. To keep tests fast and isolated we:
//  - bypass the script and apply the SQL migration files directly to the fresh DB handle
//  - also create the FTS5 virtual table (the search provider needs it)
//  - seed the singleton `settings` row, the way the script does
//
// Call `setupTestDb()` from every test that touches the DB (or once in beforeEach).
//
// Why not call Drizzle's `migrate()`? It works, but it leaves a `__drizzle_migrations` table behind
// and is slower; we'd rather control the surface explicitly for tests.

import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resetCachedDb, getDb, createDb } from '@compass/db';
import { resetCachedSearch } from '@compass/search';
import { DEFAULT_SETTINGS, nowIso } from '@compass/shared';
import * as sqliteSchema from '../../packages/db/src/schema/sqlite.js';

const MIGRATIONS_DIR = resolve(
  new URL('.', import.meta.url).pathname,
  '..',
  '..',
  'packages',
  'db',
  'migrations',
  'sqlite',
);

/**
 * Create an isolated, migrated SQLite DB for a test. Sets COMPASS_SQLITE_PATH to a fresh tmp file
 * and resets the cached db handle so the next `getDb()` picks up the new path.
 *
 * Returns the resolved handle for convenience.
 */
export function setupTestDb() {
  const dir = mkdtempSync(join(tmpdir(), 'compass-test-'));
  const path = join(dir, 'test.db');
  process.env.COMPASS_DB_DIALECT = 'sqlite';
  process.env.COMPASS_SQLITE_PATH = path;
  resetCachedDb();
  resetCachedSearch();
  const handle = getDb();
  applyMigrations(handle.raw as Database.Database);
  seedSettings(handle);
  return handle;
}

function applyMigrations(raw: Database.Database) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // better-sqlite3 doesn't allow multiple statements in `prepare`, but `exec` does.
    raw.exec(sql);
  }
  // FTS5 virtual table — the migrate.ts script does this separately.
  raw.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      entity_type UNINDEXED,
      entity_id UNINDEXED,
      title,
      body,
      tags,
      tokenize = 'porter unicode61'
    );
  `);
}

function seedSettings(handle: ReturnType<typeof getDb>) {
  const raw = handle.raw as Database.Database;
  raw
    .prepare(
      `INSERT OR IGNORE INTO settings (id, data_json, updated_at) VALUES (?, ?, ?)`,
    )
    .run('SINGLETON', JSON.stringify(DEFAULT_SETTINGS), nowIso());
}

export function teardownTestDb() {
  resetCachedDb();
  resetCachedSearch();
}

export { sqliteSchema };
