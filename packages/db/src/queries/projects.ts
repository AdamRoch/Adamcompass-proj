import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { newUlid, nowIso, type Project, type ProjectStage } from '@compass/shared';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export async function listProjects(filters: {
  stage?: ProjectStage;
  status?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<Project[]> {
  const handle = getDb();
  const t = handle.schema.project;
  const conds = [] as ReturnType<typeof eq>[];
  if (filters.stage) conds.push(eq(t.stage, filters.stage));
  if (filters.status) conds.push(eq(t.status, filters.status));
  if (!filters.includeArchived) {
    conds.push(or(isNull(t.stage), eq(t.stage, 'idea'), eq(t.stage, 'prd'), eq(t.stage, 'building'), eq(t.stage, 'review'), eq(t.stage, 'shipped'))!);
  }
  const rows = await handle.db
    .select()
    .from(t)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.last_touched_at))
    .limit(filters.limit ?? 200);
  return rows as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.project)
    .where(eq(handle.schema.project.id, id))
    .limit(1);
  return (rows[0] as Project | undefined) ?? null;
}

export async function createProject(input: {
  title: string;
  summary?: string;
  body_markdown?: string;
  prd_url?: string;
  stage?: ProjectStage;
  status?: 'active' | 'parked' | 'done';
  target_date?: string;
  repo_url?: string;
  deploy_url?: string;
  design_url?: string;
}): Promise<Project> {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.project).values({
    id,
    title: input.title,
    summary: input.summary ?? null,
    body_markdown: input.body_markdown ?? null,
    prd_url: input.prd_url ?? null,
    stage: input.stage ?? 'idea',
    status: input.status ?? 'active',
    progress_pct: null,
    target_date: input.target_date ?? null,
    repo_url: input.repo_url ?? null,
    deploy_url: input.deploy_url ?? null,
    design_url: input.design_url ?? null,
    snoozed_until: null,
    snooze_reason: null,
    stall_threshold_days: null,
    created_at: now,
    last_touched_at: now,
  });
  await touchEntity({ type: 'project', id, at: now, event: { type: 'created' } });
  return (await getProject(id))!;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>,
): Promise<Project | null> {
  const handle = getDb();
  const existing = await getProject(id);
  if (!existing) return null;
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (k === 'id' || k === 'created_at' || k === 'last_touched_at') continue;
    update[k] = (patch as Record<string, unknown>)[k];
  }
  if (Object.keys(update).length === 0) return existing;
  await handle.db.update(handle.schema.project).set(update).where(eq(handle.schema.project.id, id));
  const event_type = patch.stage && patch.stage !== existing.stage ? 'stage_changed' : 'updated';
  await touchEntity({
    type: 'project',
    id,
    event: {
      type: event_type,
      payload:
        event_type === 'stage_changed'
          ? { from: existing.stage, to: patch.stage }
          : { fields: Object.keys(update) },
    },
  });
  return await getProject(id);
}

export async function snoozeProject(
  id: string,
  until: string,
  reason: string,
): Promise<Project | null> {
  const handle = getDb();
  await handle.db
    .update(handle.schema.project)
    .set({ snoozed_until: until, snooze_reason: reason })
    .where(eq(handle.schema.project.id, id));
  await touchEntity({
    type: 'project',
    id,
    event: { type: 'snoozed', payload: { until, reason } },
  });
  return await getProject(id);
}

export async function unsnoozeProject(id: string): Promise<Project | null> {
  const handle = getDb();
  await handle.db
    .update(handle.schema.project)
    .set({ snoozed_until: null, snooze_reason: null })
    .where(eq(handle.schema.project.id, id));
  await touchEntity({ type: 'project', id, event: { type: 'unsnoozed' } });
  return await getProject(id);
}

export async function archiveProject(id: string): Promise<Project | null> {
  return updateProject(id, { stage: 'archived' });
}
