import { and, desc, eq, isNull } from 'drizzle-orm';
import { newUlid, nowIso, type Note } from '@compass/shared';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export async function listInbox(limit = 100): Promise<Note[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.note)
    .where(isNull(handle.schema.note.entity_id))
    .orderBy(desc(handle.schema.note.created_at))
    .limit(limit);
  return rows as Note[];
}

export async function getNote(id: string): Promise<Note | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.note)
    .where(eq(handle.schema.note.id, id))
    .limit(1);
  return (rows[0] as Note | undefined) ?? null;
}

export async function listNotesForEntity(
  entityType: 'project' | 'learning_goal',
  entityId: string,
  limit = 50,
): Promise<Note[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.note)
    .where(
      and(
        eq(handle.schema.note.entity_type, entityType),
        eq(handle.schema.note.entity_id, entityId),
      ),
    )
    .orderBy(desc(handle.schema.note.created_at))
    .limit(limit);
  return rows as Note[];
}

export async function fileNoteToEntity(
  noteId: string,
  target: { type: 'project' | 'learning_goal'; id: string },
): Promise<Note | null> {
  const handle = getDb();
  await handle.db
    .update(handle.schema.note)
    .set({ entity_type: target.type, entity_id: target.id })
    .where(eq(handle.schema.note.id, noteId));
  // Single bump pair: `filed` on the note touches both the note and its new parent.
  await touchEntity({
    type: 'note',
    id: noteId,
    event: { type: 'filed', payload: { target_type: target.type, target_id: target.id } },
    alsoTouch: [{ type: target.type, id: target.id }],
  });
  // Separate event row on the parent so its activity feed shows "note_added"; touching the
  // parent again here would be redundant — `alsoTouch` above already bumped its last_touched_at.
  const at = nowIso();
  await handle.db.insert(handle.schema.activity_event).values({
    id: newUlid(),
    entity_type: target.type,
    entity_id: target.id,
    event_type: 'note_added',
    payload_json: JSON.stringify({ note_id: noteId }),
    occurred_at: at,
    received_at: at,
  });
  return await getNote(noteId);
}

export async function updateNoteBody(noteId: string, body: string, title?: string | null) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.note)
    .set({ body_markdown: body, ...(title !== undefined ? { title } : {}) })
    .where(eq(handle.schema.note.id, noteId));
  await touchEntity({ type: 'note', id: noteId, event: { type: 'updated' } });
  return await getNote(noteId);
}

export async function createNoteForEntity(input: {
  entity_type: 'project' | 'learning_goal';
  entity_id: string;
  body_markdown: string;
  title?: string;
}): Promise<Note> {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.note).values({
    id,
    title: input.title ?? null,
    body_markdown: input.body_markdown,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    inbox_type_hint: 'note',
    created_at: now,
    last_touched_at: now,
  });
  // Single touch pair: bump the note (its own `created` event) and bump the parent's
  // last_touched_at via alsoTouch.
  await touchEntity({
    type: 'note',
    id,
    at: now,
    event: { type: 'created' },
    alsoTouch: [{ type: input.entity_type, id: input.entity_id }],
  });
  // The parent gets its own `note_added` event so its activity feed renders the relation;
  // we write the event row directly rather than calling touchEntity again to avoid a redundant
  // last_touched_at update.
  await handle.db.insert(handle.schema.activity_event).values({
    id: newUlid(),
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    event_type: 'note_added',
    payload_json: JSON.stringify({ note_id: id }),
    occurred_at: now,
    received_at: now,
  });
  return (await getNote(id))!;
}
