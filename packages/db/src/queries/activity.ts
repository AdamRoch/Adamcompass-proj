import type { ActivityEvent, EntityType } from '@compass/shared';
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { getDb } from '../index.js';

export async function listForEntity(
  entityType: EntityType,
  entityId: string,
  limit = 50,
): Promise<ActivityEvent[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.activity_event)
    .where(
      and(
        eq(handle.schema.activity_event.entity_type, entityType),
        eq(handle.schema.activity_event.entity_id, entityId),
      ),
    )
    .orderBy(desc(handle.schema.activity_event.occurred_at))
    .limit(limit);
  return rows as ActivityEvent[];
}

export interface ActivityPage {
  events: ActivityEvent[];
  /** Opaque keyset cursor for the next page; null when exhausted. */
  next_cursor: string | null;
}

/**
 * Global feed with keyset pagination. Cursor is `${occurred_at}|${id}` of the last row —
 * stable under concurrent inserts, unlike OFFSET.
 */
export async function recentPaged(opts: {
  cursor?: string | null;
  types?: EntityType[];
  limit?: number;
}): Promise<ActivityPage> {
  const handle = getDb();
  const t = handle.schema.activity_event;
  // NaN-safe: `?limit=abc` from the route arrives as NaN, which ?? doesn't catch.
  const limit = Number.isFinite(opts.limit) ? Math.min(Math.max(opts.limit as number, 1), 200) : 50;
  const conds = [];
  if (opts.types && opts.types.length > 0) conds.push(inArray(t.entity_type, opts.types));
  if (opts.cursor) {
    const sep = opts.cursor.lastIndexOf('|');
    if (sep > 0) {
      const at = opts.cursor.slice(0, sep);
      const id = opts.cursor.slice(sep + 1);
      conds.push(or(lt(t.occurred_at, at), and(eq(t.occurred_at, at), lt(t.id, id)))!);
    }
  }
  const rows = (await handle.db
    .select()
    .from(t)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.occurred_at), desc(t.id))
    .limit(limit + 1)) as ActivityEvent[];

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const last = events[events.length - 1];
  return {
    events,
    next_cursor: hasMore && last ? `${last.occurred_at}|${last.id}` : null,
  };
}

export async function recent(limit = 100): Promise<ActivityEvent[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.activity_event)
    .orderBy(desc(handle.schema.activity_event.occurred_at))
    .limit(limit);
  return rows as ActivityEvent[];
}
