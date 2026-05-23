import { and, desc, eq } from 'drizzle-orm';
import { newUlid, nowIso, type RunStatus } from '@compass/shared';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export interface BuildRunRow {
  id: string;
  project_id: string;
  objective: string | null;
  status: RunStatus;
  body_markdown: string | null;
  links_json: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  created_at: string;
  last_touched_at: string;
}

export async function get(id: string): Promise<BuildRunRow | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.build_run)
    .where(eq(handle.schema.build_run.id, id))
    .limit(1);
  return (rows[0] as BuildRunRow | undefined) ?? null;
}

export async function listForProject(projectId: string, limit = 50): Promise<BuildRunRow[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.build_run)
    .where(eq(handle.schema.build_run.project_id, projectId))
    .orderBy(desc(handle.schema.build_run.created_at))
    .limit(limit);
  return rows as BuildRunRow[];
}

/**
 * Upsert a build run record on receiving a webhook event. Recomputes status from event_type.
 * Returns the resulting row + whether it was a new row.
 */
export async function upsertFromEvent(input: {
  run_id: string;
  project_id: string;
  event_type: 'queued' | 'started' | 'progress' | 'completed' | 'failed';
  occurred_at: string;
  result?: string;
  body_markdown?: string;
  links?: Array<{ kind: string; url: string; label?: string }>;
  duration_ms?: number;
  objective?: string;
}): Promise<{ row: BuildRunRow; created: boolean }> {
  const handle = getDb();
  const existing = await get(input.run_id);
  const now = nowIso();

  const status = computeStatus(input.event_type, existing?.status);
  const links_json = input.links ? JSON.stringify(input.links) : existing?.links_json ?? '[]';
  const body_markdown = input.body_markdown ?? existing?.body_markdown ?? null;
  const started_at =
    existing?.started_at ?? (input.event_type === 'started' ? input.occurred_at : null);
  const ended_at =
    input.event_type === 'completed' || input.event_type === 'failed' ? input.occurred_at : existing?.ended_at ?? null;
  const duration_ms = input.duration_ms ?? existing?.duration_ms ?? null;
  const objective = input.objective ?? existing?.objective ?? null;

  if (!existing) {
    await handle.db.insert(handle.schema.build_run).values({
      id: input.run_id,
      project_id: input.project_id,
      objective,
      status,
      body_markdown,
      links_json,
      started_at,
      ended_at,
      duration_ms,
      created_at: now,
      last_touched_at: now,
    });
    await touchEntity({
      type: 'build_run',
      id: input.run_id,
      at: now,
      event: { type: 'run_event', payload: { event_type: input.event_type } },
      alsoTouch: [{ type: 'project', id: input.project_id }],
    });
    return { row: (await get(input.run_id))!, created: true };
  }

  await handle.db
    .update(handle.schema.build_run)
    .set({ status, body_markdown, links_json, started_at, ended_at, duration_ms, objective })
    .where(eq(handle.schema.build_run.id, input.run_id));
  await touchEntity({
    type: 'build_run',
    id: input.run_id,
    event: { type: 'run_event', payload: { event_type: input.event_type } },
    alsoTouch: [{ type: 'project', id: input.project_id }],
  });
  return { row: (await get(input.run_id))!, created: false };
}

function computeStatus(
  eventType: 'queued' | 'started' | 'progress' | 'completed' | 'failed',
  prev?: RunStatus,
): RunStatus {
  if (eventType === 'failed' || eventType === 'completed') return eventType;
  if (prev === 'completed' || prev === 'failed') return prev;
  if (eventType === 'queued') return 'queued';
  if (eventType === 'started' || eventType === 'progress') return 'running';
  return prev ?? 'queued';
}

export async function checkAndRecordDedup(
  run_id: string,
  event_seq: number,
  activity_event_id: string,
): Promise<{ duplicate: boolean }> {
  const handle = getDb();
  try {
    await handle.db.insert(handle.schema.run_event_dedup).values({
      run_id,
      event_seq,
      activity_event_id,
      received_at: nowIso(),
    });
    return { duplicate: false };
  } catch {
    return { duplicate: true };
  }
}
