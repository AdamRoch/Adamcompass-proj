import { and, desc, eq } from 'drizzle-orm';
import { newUlid, nowIso, type ReadingStatus, type ResourceKind } from '@compass/shared';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export interface ResourceRow {
  id: string;
  title: string;
  author_source: string | null;
  url: string | null;
  kind: ResourceKind;
  reading_status: ReadingStatus;
  rating: number | null;
  learning_goal_id: string | null;
  note_id: string | null;
  created_at: string;
  last_touched_at: string;
}

export async function list(filters: {
  status?: ReadingStatus;
  kind?: ResourceKind;
  learning_goal_id?: string;
  limit?: number;
}): Promise<ResourceRow[]> {
  const handle = getDb();
  const t = handle.schema.resource;
  const conds = [] as ReturnType<typeof eq>[];
  if (filters.status) conds.push(eq(t.reading_status, filters.status));
  if (filters.kind) conds.push(eq(t.kind, filters.kind));
  if (filters.learning_goal_id) conds.push(eq(t.learning_goal_id, filters.learning_goal_id));
  const rows = await handle.db
    .select()
    .from(t)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.last_touched_at))
    .limit(filters.limit ?? 200);
  return rows as ResourceRow[];
}

export async function get(id: string): Promise<ResourceRow | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.resource)
    .where(eq(handle.schema.resource.id, id))
    .limit(1);
  return (rows[0] as ResourceRow | undefined) ?? null;
}

export async function create(input: {
  title: string;
  author_source?: string;
  url?: string;
  kind?: ResourceKind;
  reading_status?: ReadingStatus;
  rating?: number;
  learning_goal_id?: string;
}): Promise<ResourceRow> {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.resource).values({
    id,
    title: input.title,
    author_source: input.author_source ?? null,
    url: input.url ?? null,
    kind: input.kind ?? 'article',
    reading_status: input.reading_status ?? 'to_read',
    rating: input.rating ?? null,
    learning_goal_id: input.learning_goal_id ?? null,
    note_id: null,
    created_at: now,
    last_touched_at: now,
  });
  await touchEntity({
    type: 'resource',
    id,
    at: now,
    event: { type: 'created' },
    alsoTouch: input.learning_goal_id
      ? [{ type: 'learning_goal', id: input.learning_goal_id }]
      : undefined,
  });
  return (await get(id))!;
}

export async function update(id: string, patch: Partial<ResourceRow>) {
  const handle = getDb();
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (k === 'id' || k === 'created_at' || k === 'last_touched_at') continue;
    update[k] = (patch as Record<string, unknown>)[k];
  }
  if (Object.keys(update).length === 0) return get(id);
  await handle.db
    .update(handle.schema.resource)
    .set(update)
    .where(eq(handle.schema.resource.id, id));
  await touchEntity({
    type: 'resource',
    id,
    event: { type: 'updated', payload: { fields: Object.keys(update) } },
  });
  return await get(id);
}
