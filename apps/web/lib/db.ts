// Single entry point for app code to access the db handle. Keeping this thin avoids accidentally
// instantiating multiple connections from different call sites in dev (where Next hot-reloads).
import { getDb, type DbHandle } from '@compass/db';

declare global {
  // eslint-disable-next-line no-var
  var __compassDb: DbHandle | undefined;
}

export function db(): DbHandle {
  if (globalThis.__compassDb) return globalThis.__compassDb;
  const handle = getDb();
  globalThis.__compassDb = handle;
  return handle;
}
