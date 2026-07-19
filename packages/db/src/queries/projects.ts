import {
  type Project,
  type ProjectStage,
  type ProjectStatus,
  newUlid,
  nowIso,
} from '@compass/shared';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export async function listProjects(filters: {
  stage?: ProjectStage;
  status?: ProjectStatus;
  includeArchived?: boolean;
  limit?: number;
}): Promise<Project[]> {
  const handle = getDb();
  const t = handle.schema.project;
  const conds = [] as ReturnType<typeof eq>[];
  if (filters.stage) conds.push(eq(t.stage, filters.stage));
  if (filters.status) conds.push(eq(t.status, filters.status));
  if (!filters.includeArchived) {
    conds.push(
      or(
        isNull(t.stage),
        eq(t.stage, 'idea'),
        eq(t.stage, 'prd'),
        eq(t.stage, 'building'),
        eq(t.stage, 'review'),
        eq(t.stage, 'shipped'),
      )!,
    );
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

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.project)
    .where(eq(handle.schema.project.slug, slug))
    .limit(1);
  return (rows[0] as Project | undefined) ?? null;
}

/** kebab-case slug from a title; numeric suffix on collision (my-app, my-app-2, …). */
async function deriveSlug(title: string): Promise<string | null> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!base) return null;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await getProjectBySlug(candidate))) return candidate;
  }
  return null; // pathological collision run — slug stays null, ULID still works everywhere
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
  const slug = await deriveSlug(input.title);
  await handle.db.insert(handle.schema.project).values({
    id,
    title: input.title,
    slug,
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

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | null> {
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

export async function archiveProject(id: string, reason?: string): Promise<Project | null> {
  const handle = getDb();
  const existing = await getProject(id);
  if (!existing) return null;
  if (existing.stage === 'archived') return existing;
  await handle.db
    .update(handle.schema.project)
    .set({ stage: 'archived' })
    .where(eq(handle.schema.project.id, id));
  // `from` in the payload is what restore uses to put the project back where it was.
  await touchEntity({
    type: 'project',
    id,
    event: { type: 'archived', payload: { from: existing.stage, reason: reason ?? null } },
  });
  return await getProject(id);
}

export async function restoreProject(id: string): Promise<Project | null> {
  const handle = getDb();
  const existing = await getProject(id);
  if (!existing) return null;
  if (existing.stage !== 'archived') return existing;
  const events = await handle.db
    .select()
    .from(handle.schema.activity_event)
    .where(
      and(
        eq(handle.schema.activity_event.entity_type, 'project'),
        eq(handle.schema.activity_event.entity_id, id),
        eq(handle.schema.activity_event.event_type, 'archived'),
      ),
    )
    .orderBy(desc(handle.schema.activity_event.occurred_at))
    .limit(1);
  let from: ProjectStage = 'idea';
  try {
    const payload = JSON.parse(events[0]?.payload_json ?? '{}') as { from?: ProjectStage };
    if (payload.from && payload.from !== 'archived') from = payload.from;
  } catch {
    // fall through to 'idea'
  }
  await handle.db
    .update(handle.schema.project)
    .set({ stage: from })
    .where(eq(handle.schema.project.id, id));
  await touchEntity({ type: 'project', id, event: { type: 'restored', payload: { to: from } } });
  return await getProject(id);
}
