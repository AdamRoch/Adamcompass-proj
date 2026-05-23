import { eq } from 'drizzle-orm';
import { newUlid, nowIso } from '@compass/shared';
import type { EntityType } from '@compass/shared';
import { getDb } from './index.js';

interface TouchOpts {
  type: EntityType;
  id: string;
  event: { type: string; payload?: Record<string, unknown> };
  at?: string;
  alsoTouch?: { type: EntityType; id: string }[];
}

/**
 * Single source of truth for "an entity changed":
 *   - bumps last_touched_at on the entity (any-write semantics, per PRD §10.1)
 *   - writes an activity_event row with the event details
 *   - optionally bumps last_touched_at on parent entities (e.g. note → project)
 *
 * All updates use Drizzle's typed builder — no raw SQL interpolation.
 */
export async function touchEntity(opts: TouchOpts): Promise<{ event_id: string }> {
  const handle = getDb();
  const at = opts.at ?? nowIso();
  const eventId = newUlid();
  const payloadJson = JSON.stringify(opts.event.payload ?? {});

  await touchOne(opts.type, opts.id, at);
  for (const extra of opts.alsoTouch ?? []) {
    await touchOne(extra.type, extra.id, at);
  }

  await handle.db.insert(handle.schema.activity_event).values({
    id: eventId,
    entity_type: opts.type,
    entity_id: opts.id,
    event_type: opts.event.type,
    payload_json: payloadJson,
    occurred_at: at,
    received_at: at,
  });

  return { event_id: eventId };
}

async function touchOne(type: EntityType, id: string, at: string): Promise<void> {
  const handle = getDb();
  switch (type) {
    case 'project':
      await handle.db
        .update(handle.schema.project)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.project.id, id));
      return;
    case 'learning_goal':
      await handle.db
        .update(handle.schema.learning_goal)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.learning_goal.id, id));
      return;
    case 'note':
      await handle.db
        .update(handle.schema.note)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.note.id, id));
      return;
    case 'milestone':
      await handle.db
        .update(handle.schema.milestone)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.milestone.id, id));
      return;
    case 'checklist_item':
      await handle.db
        .update(handle.schema.checklist_item)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.checklist_item.id, id));
      return;
    case 'resource':
      await handle.db
        .update(handle.schema.resource)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.resource.id, id));
      return;
    case 'build_run':
      await handle.db
        .update(handle.schema.build_run)
        .set({ last_touched_at: at })
        .where(eq(handle.schema.build_run.id, id));
      return;
    default: {
      const _exhaustive: never = type;
      throw new Error(`touchOne: unknown entity type ${String(_exhaustive)}`);
    }
  }
}
