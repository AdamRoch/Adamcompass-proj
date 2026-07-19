import { newUlid } from '@compass/shared';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../index.js';

export async function list() {
  const handle = getDb();
  return await handle.db.select().from(handle.schema.tag);
}

export async function listWithCounts(): Promise<
  Array<{ id: string; name: string; count: number }>
> {
  const handle = getDb();
  const t = handle.schema.tag;
  const tg = handle.schema.tagging;
  const rows = await handle.db
    .select({ id: t.id, name: t.name, count: sql<number>`count(${tg.tag_id})` })
    .from(t)
    .leftJoin(tg, eq(tg.tag_id, t.id))
    .groupBy(t.id, t.name);
  return rows
    .map((r) => ({ id: r.id, name: r.name, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function ensure(name: string): Promise<{ id: string; name: string }> {
  const handle = getDb();
  const normalized = name.toLowerCase().trim();
  const existing = await handle.db
    .select()
    .from(handle.schema.tag)
    .where(eq(handle.schema.tag.name, normalized))
    .limit(1);
  if (existing[0]) return existing[0];
  const id = newUlid();
  await handle.db.insert(handle.schema.tag).values({ id, name: normalized });
  return { id, name: normalized };
}

export async function rename(tagId: string, newName: string) {
  const handle = getDb();
  const normalized = newName.toLowerCase().trim();
  await handle.db
    .update(handle.schema.tag)
    .set({ name: normalized })
    .where(eq(handle.schema.tag.id, tagId));
}

export async function taggingsForTag(
  tagId: string,
): Promise<Array<{ entity_type: string; entity_id: string }>> {
  const handle = getDb();
  return await handle.db
    .select({
      entity_type: handle.schema.tagging.entity_type,
      entity_id: handle.schema.tagging.entity_id,
    })
    .from(handle.schema.tagging)
    .where(eq(handle.schema.tagging.tag_id, tagId));
}

/** Re-point every tagging from `fromId` onto `intoId`, then delete the source tag. */
export async function merge(fromId: string, intoId: string): Promise<boolean> {
  const handle = getDb();
  if (fromId === intoId) return false;
  const [from, into] = await Promise.all([
    handle.db.select().from(handle.schema.tag).where(eq(handle.schema.tag.id, fromId)).limit(1),
    handle.db.select().from(handle.schema.tag).where(eq(handle.schema.tag.id, intoId)).limit(1),
  ]);
  if (!from[0] || !into[0]) return false;
  const taggings = await handle.db
    .select()
    .from(handle.schema.tagging)
    .where(eq(handle.schema.tagging.tag_id, fromId));
  for (const t of taggings) {
    await attach(intoId, t.entity_type, t.entity_id);
  }
  await handle.db.delete(handle.schema.tagging).where(eq(handle.schema.tagging.tag_id, fromId));
  await handle.db.delete(handle.schema.tag).where(eq(handle.schema.tag.id, fromId));
  return true;
}

/** Delete a tag only when nothing references it. Returns false if still in use (or missing). */
export async function removeIfUnused(tagId: string): Promise<boolean> {
  const handle = getDb();
  const used = await handle.db
    .select({ c: sql<number>`count(*)` })
    .from(handle.schema.tagging)
    .where(eq(handle.schema.tagging.tag_id, tagId));
  if (Number(used[0]?.c ?? 0) > 0) return false;
  const deleted = await handle.db
    .delete(handle.schema.tag)
    .where(eq(handle.schema.tag.id, tagId))
    .returning({ id: handle.schema.tag.id });
  return deleted.length > 0;
}

export async function attach(tagId: string, entityType: string, entityId: string) {
  const handle = getDb();
  try {
    await handle.db
      .insert(handle.schema.tagging)
      .values({ tag_id: tagId, entity_type: entityType, entity_id: entityId });
  } catch {
    // Duplicate PK is fine
  }
}

export async function detach(tagId: string, entityType: string, entityId: string) {
  const handle = getDb();
  await handle.db
    .delete(handle.schema.tagging)
    .where(
      and(
        eq(handle.schema.tagging.tag_id, tagId),
        eq(handle.schema.tagging.entity_type, entityType),
        eq(handle.schema.tagging.entity_id, entityId),
      ),
    );
}

export async function tagsForEntity(entityType: string, entityId: string) {
  const handle = getDb();
  const rows = await handle.db
    .select({ id: handle.schema.tag.id, name: handle.schema.tag.name })
    .from(handle.schema.tagging)
    .innerJoin(handle.schema.tag, eq(handle.schema.tag.id, handle.schema.tagging.tag_id))
    .where(
      and(
        eq(handle.schema.tagging.entity_type, entityType),
        eq(handle.schema.tagging.entity_id, entityId),
      ),
    );
  return rows;
}
