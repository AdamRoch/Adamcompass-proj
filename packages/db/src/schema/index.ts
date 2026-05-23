// Re-export the active dialect's schema. Selected at module-load time via COMPASS_DB_DIALECT.
// In tests or scripts that need the *other* dialect, import directly from ./sqlite or ./pg.

import type { DbDialect } from '@compass/shared';

export function getActiveDialect(): DbDialect {
  const v = process.env.COMPASS_DB_DIALECT;
  if (v === 'pg') return 'pg';
  return 'sqlite';
}

export * as sqliteSchema from './sqlite.js';
export * as pgSchema from './pg.js';
