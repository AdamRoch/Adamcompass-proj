// Verifies the helper used by all DB tests actually creates the expected schema.
//
// We don't import migrate.ts itself (it's a top-level script — see report). Instead the helper
// reads the hand-rolled SQL files under packages/db/migrations/sqlite/ and applies them. This test
// asserts the migration is structurally correct end-to-end:
//   - core tables exist
//   - the FTS5 virtual table exists and is queryable
//   - the singleton settings row is seeded
//
// If we ever refactor migrate.ts into an exportable `runMigrations()` library function, this is
// the test that should call it directly.

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import { DEFAULT_SETTINGS } from '@compass/shared';

const CORE_TABLES = [
  'user',
  'auth_token',
  'device_code',
  'project',
  'learning_goal',
  'note',
  'milestone',
  'checklist_item',
  'resource',
  'build_run',
  'activity_event',
  'run_event_dedup',
  'tag',
  'tagging',
  'settings',
  'notifications',
  'stall_alerts',
  'webhook_deliveries',
  'audit_log',
  'capture_dedup',
];

describe('migrations', () => {
  it('apply cleanly to a fresh in-memory DB', () => {
    const handle = setupTestDb();
    const raw = handle.raw as Database.Database;
    const found = raw
      .prepare(`SELECT name FROM sqlite_master WHERE type IN ('table') AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;
    const names = new Set(found.map((r) => r.name));
    for (const t of CORE_TABLES) {
      expect(names.has(t), `expected table "${t}" to exist`).toBe(true);
    }
  });

  it('creates the FTS5 virtual table', () => {
    const handle = setupTestDb();
    const raw = handle.raw as Database.Database;
    // The FTS5 module creates several backing tables (search_index, search_index_data, ...).
    const found = raw
      .prepare(`SELECT name FROM sqlite_master WHERE name LIKE 'search_index%'`)
      .all() as Array<{ name: string }>;
    expect(found.length).toBeGreaterThan(0);

    // Ensure we can actually INSERT + SELECT via the virtual table.
    raw
      .prepare(
        `INSERT INTO search_index (entity_type, entity_id, title, body, tags) VALUES (?, ?, ?, ?, ?)`,
      )
      .run('note', '01ABCDEFGHJKMNPQRSTUVWXYZ0', 'hello world', 'a body about ships', 'demo');
    const rows = raw
      .prepare(`SELECT entity_id FROM search_index WHERE search_index MATCH 'hello'`)
      .all() as Array<{ entity_id: string }>;
    expect(rows.length).toBe(1);
  });

  it('seeds the settings singleton row', () => {
    const handle = setupTestDb();
    const raw = handle.raw as Database.Database;
    const row = raw.prepare(`SELECT * FROM settings WHERE id = ?`).get('SINGLETON') as
      | { id: string; data_json: string; updated_at: string }
      | undefined;
    expect(row).toBeTruthy();
    const data = JSON.parse(row!.data_json);
    expect(data.timezone).toBe(DEFAULT_SETTINGS.timezone);
    expect(data.default_stall_threshold_project_days).toBe(
      DEFAULT_SETTINGS.default_stall_threshold_project_days,
    );
  });
});
