// Applies migrations to the active dialect. Also creates the FTS5 virtual table (SQLite) or the
// search_index + tsvector table (Postgres) which Drizzle doesn't manage.
//
// Usage: pnpm db:migrate

import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './index.js';
import { SEARCH_INDEX_CREATE_SQL as PG_SEARCH_SQL } from './schema/pg.js';
import { SEARCH_INDEX_CREATE_SQL as SQLITE_SEARCH_SQL } from './schema/sqlite.js';

async function main() {
  // Ensure the SQLite data directory exists BEFORE createDb() tries to open the file.
  // (The module itself is bundler-friendly and doesn't touch fs.)
  if ((process.env.COMPASS_DB_DIALECT ?? 'sqlite') === 'sqlite') {
    const rawPath = process.env.COMPASS_SQLITE_PATH ?? './data/compass.db';
    if (rawPath !== ':memory:') {
      const abs = isAbsolute(rawPath)
        ? rawPath
        : resolve(process.env.COMPASS_PROJECT_ROOT ?? process.cwd(), rawPath);
      mkdirSync(dirname(abs), { recursive: true });
    }
  }

  const handle = createDb();
  const folder = resolve(
    new URL('.', import.meta.url).pathname,
    '..',
    'migrations',
    handle.dialect,
  );
  console.log(`[migrate] dialect=${handle.dialect} folder=${folder}`);

  if (handle.dialect === 'sqlite') {
    migrateSqlite(handle.db as never, { migrationsFolder: folder });
    await handle.db.run(SQLITE_SEARCH_SQL);
    console.log('[migrate] sqlite + FTS5 virtual table ok');
  } else {
    await migratePg(handle.db as never, { migrationsFolder: folder });
    await (handle.db as unknown as import('./index.js').PgDb).execute(PG_SEARCH_SQL);
    console.log('[migrate] postgres + tsvector index ok');
  }

  // Insert the singleton settings row if not present.
  const { DEFAULT_SETTINGS, nowIso } = await import('@compass/shared');
  await handle.db
    .insert(handle.schema.settings)
    .values({ id: 'SINGLETON', data_json: JSON.stringify(DEFAULT_SETTINGS), updated_at: nowIso() })
    .onConflictDoNothing();
  console.log('[migrate] settings singleton ensured');
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
