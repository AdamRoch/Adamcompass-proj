// Postgres app-level smoke test — the missing half of the dual-dialect test matrix.
//
// Runs ONLY when COMPASS_TEST_PG_URL is set (a dedicated scratch database — the suite
// drops and recreates its public schema on every run). Locally without Postgres the
// whole describe block is skipped; CI can provide a service container.
//
//   COMPASS_TEST_PG_URL=postgres://compass:compass@localhost:5432/compass_test pnpm test

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type DbHandle, createDb, resetCachedDb } from '@compass/db';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PG_URL = process.env.COMPASS_TEST_PG_URL;

const MIGRATIONS_DIR = resolve(
  new URL('.', import.meta.url).pathname,
  '..',
  '..',
  'migrations',
  'pg',
);

describe.skipIf(!PG_URL)('postgres smoke (app-level)', () => {
  let handle: DbHandle;
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    // Guard against pointing this suite at a real database: the target's name must
    // contain "test" or the destructive schema reset refuses to run.
    const dbName = new URL(PG_URL as string).pathname.slice(1);
    if (!/test/i.test(dbName) && process.env.COMPASS_TEST_PG_DESTRUCTIVE !== '1') {
      throw new Error(
        `pg-smoke refuses to DROP SCHEMA on "${dbName}" — name must contain "test", or set COMPASS_TEST_PG_DESTRUCTIVE=1 if you really mean it.`,
      );
    }
    handle = createDb({ dialect: 'pg', url: PG_URL });
    sql = handle.raw as ReturnType<typeof postgres>;
    await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    for (const file of readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await sql.unsafe(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }
    // Point the module-level cached handle at this PG database so query modules use it.
    process.env.COMPASS_DB_DIALECT = 'pg';
    process.env.DATABASE_URL = PG_URL;
    resetCachedDb();
  });

  afterAll(async () => {
    resetCachedDb();
    process.env.COMPASS_DB_DIALECT = 'sqlite';
    // biome-ignore lint/performance/noDelete: assigning undefined coerces to the string "undefined" on process.env
    delete process.env.DATABASE_URL;
    await sql?.end({ timeout: 5 });
  });

  it('migrations apply and settings seed works', async () => {
    const { DEFAULT_SETTINGS, nowIso } = await import('@compass/shared');
    await sql`
      INSERT INTO settings (id, data_json, updated_at)
      VALUES ('SINGLETON', ${JSON.stringify(DEFAULT_SETTINGS)}, ${nowIso()})
      ON CONFLICT (id) DO NOTHING
    `;
    const projectsQ = await import('../queries/projects.js');
    const p = await projectsQ.createProject({ title: 'pg smoke' });
    expect(p.id).toHaveLength(26);
    expect((await projectsQ.getProject(p.id))?.title).toBe('pg smoke');
  });

  it('capture + dashboard counts round-trip on pg', async () => {
    const capturesQ = await import('../queries/captures.js');
    const dashboardQ = await import('../queries/dashboard.js');
    const res = await capturesQ.createCapture({
      idem_key: 'pg-1',
      client_id: 'pg-test',
      body: 'hello pg',
      tags: [],
    });
    expect(res.duplicate).toBe(false);
    const dup = await capturesQ.createCapture({
      idem_key: 'pg-1',
      client_id: 'pg-test',
      body: 'hello pg',
      tags: [],
    });
    expect(dup.duplicate).toBe(true);
    const c = await dashboardQ.counts();
    expect(c.inbox_count).toBeGreaterThanOrEqual(1);
  });

  it('V2 SQL paths run on pg: milestones progress, tag merge/counts, notes filters, archive', async () => {
    const projectsQ = await import('../queries/projects.js');
    const milestonesQ = await import('../queries/milestones.js');
    const tagsQ = await import('../queries/tags.js');
    const notesQ = await import('../queries/notes.js');

    const p = await projectsQ.createProject({ title: 'pg v2 paths' });

    // Milestones + derived progress
    const m = await milestonesQ.add({ project_id: p.id, title: 'one' });
    await milestonesQ.add({ project_id: p.id, title: 'two' });
    await milestonesQ.toggleDone(m.id);
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(50);

    // Tags: grouped counts + merge
    const a = await tagsQ.ensure('pg-a');
    const b = await tagsQ.ensure('pg-b');
    await tagsQ.attach(a.id, 'project', p.id);
    expect(await tagsQ.merge(a.id, b.id)).toBe(true);
    const counts = await tagsQ.listWithCounts();
    expect(counts.find((t) => t.name === 'pg-b')?.count).toBe(1);

    // Notes list filters
    const note = await notesQ.createNoteForEntity({
      entity_type: 'project',
      entity_id: p.id,
      body_markdown: 'pg filed note',
    });
    const filed = await notesQ.listAllNotes({ filed: 'filed' });
    expect(filed.some((n) => n.id === note.id)).toBe(true);

    // Archive → restore round-trip
    await projectsQ.archiveProject(p.id, 'pg test');
    expect((await projectsQ.getProject(p.id))?.stage).toBe('archived');
    const restored = await projectsQ.restoreProject(p.id);
    expect(restored?.stage).toBe('idea');
  });
});
