import { and, desc, eq } from 'drizzle-orm';
import type { ActivityEvent, EntityType } from '@compass/shared';
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

export async function recent(limit = 100): Promise<ActivityEvent[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.activity_event)
    .orderBy(desc(handle.schema.activity_event.occurred_at))
    .limit(limit);
  return rows as ActivityEvent[];
}
