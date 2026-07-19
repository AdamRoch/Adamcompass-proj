import { type RunStatus, newUlid, nowIso } from '@compass/shared';
import { desc, eq, inArray } from 'drizzle-orm';
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
 * Queue a run from the UI with a stated objective. The external agent picks it up out-of-band
 * (Compass records runs, it does not execute them — PRD §5.2.4) and reports back via webhook
 * using this run's id.
 */
export async function queueRun(projectId: string, objective: string): Promise<BuildRunRow> {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.build_run).values({
    id,
    project_id: projectId,
    objective: objective.slice(0, 2000),
    status: 'queued',
    body_markdown: null,
    links_json: '[]',
    started_at: null,
    ended_at: null,
    duration_ms: null,
    created_at: now,
    last_touched_at: now,
  });
  await touchEntity({
    type: 'build_run',
    id,
    at: now,
    event: { type: 'run_queued', payload: { objective: objective.slice(0, 500) } },
    alsoTouch: [{ type: 'project', id: projectId }],
  });
  return (await get(id))!;
}

/** Terminal-state runs that ended since `sinceIso` — powers the dashboard overnight summary. */
export async function recentTerminal(sinceIso: string, limit = 10): Promise<BuildRunRow[]> {
  const handle = getDb();
  const t = handle.schema.build_run;
  const rows = await handle.db
    .select()
    .from(t)
    .where(inArray(t.status, ['completed', 'failed']))
    .orderBy(desc(t.ended_at))
    .limit(limit * 3);
  // ended_at is nullable; filter + trim in JS on the small, already-capped set.
  return (rows as BuildRunRow[])
    .filter((r) => r.ended_at && r.ended_at >= sinceIso)
    .slice(0, limit);
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
  const links_json = input.links ? JSON.stringify(input.links) : (existing?.links_json ?? '[]');
  const body_markdown = input.body_markdown ?? existing?.body_markdown ?? null;
  const started_at =
    existing?.started_at ?? (input.event_type === 'started' ? input.occurred_at : null);
  const ended_at =
    input.event_type === 'completed' || input.event_type === 'failed'
      ? input.occurred_at
      : (existing?.ended_at ?? null);
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
