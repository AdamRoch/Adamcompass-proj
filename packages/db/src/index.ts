import Database from 'better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import postgres from 'postgres';
import type { DbDialect } from '@compass/shared';

import * as pgSchema from './schema/pg.js';
import * as sqliteSchema from './schema/sqlite.js';

export type SqliteDb = ReturnType<typeof drizzleSqlite<typeof sqliteSchema>>;
export type PgDb = ReturnType<typeof drizzlePg<typeof pgSchema>>;

export type Db = SqliteDb | PgDb;

export interface DbHandle {
  dialect: DbDialect;
  db: Db;
  raw: Database.Database | ReturnType<typeof postgres>;
  schema: typeof sqliteSchema | typeof pgSchema;
}

let cached: DbHandle | null = null;

export function getDb(): DbHandle {
  if (cached) return cached;
  cached = createDb();
  return cached;
}

export function createDb(opts?: { dialect?: DbDialect; url?: string }): DbHandle {
  const dialect = opts?.dialect ?? (process.env.COMPASS_DB_DIALECT === 'pg' ? 'pg' : 'sqlite');
  if (dialect === 'sqlite') {
    const rawPath = opts?.url ?? process.env.COMPASS_SQLITE_PATH ?? './data/compass.db';
    // Anchor relative paths to COMPASS_PROJECT_ROOT (or cwd if unset) so scripts run from
    // packages/db/ see the same DB file as the web app run from apps/web/.
    // fs+path are required dynamically so webpack bundling client-traced code paths doesn't
    // complain about them; this function is server-only at runtime.
    const url =
      rawPath === ':memory:' || rawPath.startsWith('/')
        ? rawPath
        : joinPath(process.env.COMPASS_PROJECT_ROOT ?? process.cwd(), rawPath);
    // Note: parent directory is expected to exist (the `migrate.ts` script ensures this on
    // first run, and the production Dockerfile mounts a volume at /data). Doing the mkdir here
    // would require importing `node:fs`, which webpack can't trace through the workspace TS
    // sources without ejecting `transpilePackages`. We keep this module bundler-friendly.
    const raw = new Database(url);
    raw.pragma('journal_mode = WAL');
    raw.pragma('foreign_keys = ON');
    raw.pragma('busy_timeout = 5000');
    const db = drizzleSqlite(raw, { schema: sqliteSchema });
    return { dialect: 'sqlite', db, raw, schema: sqliteSchema };
  }
  const url = opts?.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required when COMPASS_DB_DIALECT=pg');
  const sql = postgres(url, { max: 5, idle_timeout: 30 });
  const db = drizzlePg(sql, { schema: pgSchema });
  return { dialect: 'pg', db, raw: sql, schema: pgSchema };
}

export function resetCachedDb() {
  cached = null;
}

// Pure-string path join — keeps fs/path off the client bundle's import graph.
function joinPath(base: string, rel: string): string {
  const baseTrim = base.endsWith('/') ? base.slice(0, -1) : base;
  let relPart = rel;
  while (relPart.startsWith('./')) relPart = relPart.slice(2);
  return `${baseTrim}/${relPart}`;
}

export { pgSchema, sqliteSchema };
