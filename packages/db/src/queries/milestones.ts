import { newUlid, nowIso } from '@compass/shared';
import { eq } from 'drizzle-orm';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  order_index: number;
  created_at: string;
  last_touched_at: string;
}

export async function listForProject(projectId: string): Promise<MilestoneRow[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.milestone)
    .where(eq(handle.schema.milestone.project_id, projectId))
    .orderBy(handle.schema.milestone.order_index);
  return rows as MilestoneRow[];
}

export async function getMilestone(id: string): Promise<MilestoneRow | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.milestone)
    .where(eq(handle.schema.milestone.id, id))
    .limit(1);
  return (rows[0] as MilestoneRow | undefined) ?? null;
}

export async function add(input: { project_id: string; title: string }): Promise<MilestoneRow> {
  const handle = getDb();
  const existing = await listForProject(input.project_id);
  const nextIdx = existing.reduce((m, r) => Math.max(m, r.order_index), -1) + 1;
  const id = newUlid();
  const now = nowIso();
  const row: MilestoneRow = {
    id,
    project_id: input.project_id,
    title: input.title.slice(0, 500),
    done: false,
    order_index: nextIdx,
    created_at: now,
    last_touched_at: now,
  };
  await handle.db.insert(handle.schema.milestone).values(row);
  await touchEntity({
    type: 'milestone',
    id,
    event: { type: 'milestone_added', payload: { title: row.title } },
    alsoTouch: [{ type: 'project', id: input.project_id }],
  });
  await recomputeProgress(input.project_id);
  return row;
}

export async function toggleDone(id: string): Promise<MilestoneRow | null> {
  const handle = getDb();
  const cur = await getMilestone(id);
  if (!cur) return null;
  const next = !cur.done;
  await handle.db
    .update(handle.schema.milestone)
    .set({ done: next, last_touched_at: nowIso() })
    .where(eq(handle.schema.milestone.id, id));
  await touchEntity({
    type: 'milestone',
    id,
    event: {
      type: next ? 'milestone_completed' : 'milestone_reopened',
      payload: { title: cur.title },
    },
    alsoTouch: [{ type: 'project', id: cur.project_id }],
  });
  await recomputeProgress(cur.project_id);
  return { ...cur, done: next };
}

/** Swap order_index with the neighbor in `direction`; no-op at the edges. */
export async function move(id: string, direction: 'up' | 'down'): Promise<boolean> {
  const handle = getDb();
  const cur = await getMilestone(id);
  if (!cur) return false;
  const siblings = await listForProject(cur.project_id);
  const idx = siblings.findIndex((m) => m.id === id);
  const neighbor = siblings[direction === 'up' ? idx - 1 : idx + 1];
  if (!neighbor) return false;
  const now = nowIso();
  await handle.db
    .update(handle.schema.milestone)
    .set({ order_index: neighbor.order_index, last_touched_at: now })
    .where(eq(handle.schema.milestone.id, cur.id));
  await handle.db
    .update(handle.schema.milestone)
    .set({ order_index: cur.order_index, last_touched_at: now })
    .where(eq(handle.schema.milestone.id, neighbor.id));
  return true;
}

export async function rename(id: string, title: string): Promise<MilestoneRow | null> {
  const handle = getDb();
  const cur = await getMilestone(id);
  if (!cur) return null;
  const clean = title.trim().slice(0, 500);
  if (!clean) return cur;
  await handle.db
    .update(handle.schema.milestone)
    .set({ title: clean, last_touched_at: nowIso() })
    .where(eq(handle.schema.milestone.id, id));
  return { ...cur, title: clean };
}

export async function remove(id: string): Promise<boolean> {
  const handle = getDb();
  const cur = await getMilestone(id);
  if (!cur) return false;
  await handle.db.delete(handle.schema.milestone).where(eq(handle.schema.milestone.id, id));
  await touchEntity({
    type: 'project',
    id: cur.project_id,
    event: { type: 'milestone_removed', payload: { title: cur.title } },
  });
  await recomputeProgress(cur.project_id);
  return true;
}

/**
 * Derived progress (PRD V2 §3.1): when a project has milestones, progress_pct follows their
 * completion ratio; with zero milestones the manual value is left alone.
 */
export async function recomputeProgress(projectId: string): Promise<void> {
  const handle = getDb();
  const rows = await listForProject(projectId);
  if (rows.length === 0) return;
  const pct = Math.round((rows.filter((r) => r.done).length / rows.length) * 100);
  await handle.db
    .update(handle.schema.project)
    .set({ progress_pct: pct })
    .where(eq(handle.schema.project.id, projectId));
}
