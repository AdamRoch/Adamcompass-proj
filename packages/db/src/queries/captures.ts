import { and, eq } from 'drizzle-orm';
import { newUlid, nowIso } from '@compass/shared';
import type { CaptureRequest } from '@compass/shared/zod';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export interface CaptureResult {
  note_id: string;
  duplicate: boolean;
}

/**
 * Idempotent capture: dedupes on (client_id, idem_key).
 * Creates a note with entity_id=null (lands in Inbox) and writes an activity event.
 */
export async function createCapture(req: CaptureRequest): Promise<CaptureResult> {
  const handle = getDb();
  const now = req.captured_at ?? nowIso();

  // Race-free dedup: try to claim (client_id, idem_key) FIRST via ON CONFLICT DO NOTHING.
  // If we lose the race (or a duplicate request follows), look up the winner and return it.
  const noteId = newUlid();
  await handle.db
    .insert(handle.schema.capture_dedup)
    .values({
      client_id: req.client_id,
      idem_key: req.idem_key,
      note_id: noteId,
      created_at: now,
    })
    .onConflictDoNothing();

  const claimed = await handle.db
    .select()
    .from(handle.schema.capture_dedup)
    .where(
      and(
        eq(handle.schema.capture_dedup.client_id, req.client_id),
        eq(handle.schema.capture_dedup.idem_key, req.idem_key),
      ),
    )
    .limit(1);

  if (!claimed[0]) {
    throw new Error('capture dedup row vanished after upsert');
  }
  if (claimed[0].note_id !== noteId) {
    // Another concurrent request already created the note — return it as a duplicate.
    return { note_id: claimed[0].note_id, duplicate: true };
  }

  // We won the claim — create the note row.
  await handle.db.insert(handle.schema.note).values({
    id: noteId,
    title: null,
    body_markdown: req.body,
    entity_type: null,
    entity_id: null,
    inbox_type_hint: req.type_hint ?? 'unspecified',
    created_at: now,
    last_touched_at: now,
  });

  await touchEntity({
    type: 'note',
    id: noteId,
    at: now,
    event: {
      type: 'created',
      payload: { source: 'capture', client_id: req.client_id, type_hint: req.type_hint },
    },
  });

  // Attach tags if any
  if (req.tags && req.tags.length > 0) {
    await attachTags(noteId, 'note', req.tags);
  }

  return { note_id: noteId, duplicate: false };
}

async function attachTags(entityId: string, entityType: string, tagNames: string[]) {
  const handle = getDb();
  for (const raw of tagNames) {
    const name = raw.toLowerCase().trim();
    if (!name) continue;
    let tagId: string;
    const existing = await handle.db
      .select()
      .from(handle.schema.tag)
      .where(eq(handle.schema.tag.name, name))
      .limit(1);
    if (existing.length > 0 && existing[0]) {
      tagId = existing[0].id;
    } else {
      tagId = newUlid();
      await handle.db.insert(handle.schema.tag).values({ id: tagId, name });
    }
    try {
      await handle.db
        .insert(handle.schema.tagging)
        .values({ tag_id: tagId, entity_type: entityType, entity_id: entityId });
    } catch {
      // Duplicate is fine (composite PK conflict)
    }
  }
}
