import { and, desc, eq, or } from 'drizzle-orm';
import { newUlid, nowIso, type LearningGoal, type LearningStatus } from '@compass/shared';
import { getDb } from '../index.js';
import { touchEntity } from '../touch.js';

export async function listLearningGoals(filters: {
  status?: LearningStatus;
  includeArchived?: boolean;
  limit?: number;
}): Promise<LearningGoal[]> {
  const handle = getDb();
  const t = handle.schema.learning_goal;
  const conds = [] as ReturnType<typeof eq>[];
  if (filters.status) conds.push(eq(t.status, filters.status));
  if (!filters.includeArchived) {
    conds.push(
      or(
        eq(t.status, 'curious'),
        eq(t.status, 'in_progress'),
        eq(t.status, 'completed'),
        eq(t.status, 'parked'),
      )!,
    );
  }
  const rows = await handle.db
    .select()
    .from(t)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.last_touched_at))
    .limit(filters.limit ?? 200);
  return rows as LearningGoal[];
}

export async function getLearningGoal(id: string): Promise<LearningGoal | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.learning_goal)
    .where(eq(handle.schema.learning_goal.id, id))
    .limit(1);
  return (rows[0] as LearningGoal | undefined) ?? null;
}

export async function createLearningGoal(input: {
  title: string;
  motivation?: string;
  body_markdown?: string;
  status?: LearningStatus;
  target_date?: string;
}): Promise<LearningGoal> {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.learning_goal).values({
    id,
    title: input.title,
    motivation: input.motivation ?? null,
    body_markdown: input.body_markdown ?? null,
    status: input.status ?? 'curious',
    target_date: input.target_date ?? null,
    snoozed_until: null,
    snooze_reason: null,
    stall_threshold_days: null,
    created_at: now,
    last_touched_at: now,
  });
  await touchEntity({ type: 'learning_goal', id, at: now, event: { type: 'created' } });
  return (await getLearningGoal(id))!;
}

export async function updateLearningGoal(
  id: string,
  patch: Partial<LearningGoal>,
): Promise<LearningGoal | null> {
  const handle = getDb();
  const existing = await getLearningGoal(id);
  if (!existing) return null;
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (k === 'id' || k === 'created_at' || k === 'last_touched_at') continue;
    update[k] = (patch as Record<string, unknown>)[k];
  }
  if (Object.keys(update).length === 0) return existing;
  await handle.db
    .update(handle.schema.learning_goal)
    .set(update)
    .where(eq(handle.schema.learning_goal.id, id));
  const event_type =
    patch.status && patch.status !== existing.status ? 'status_changed' : 'updated';
  await touchEntity({
    type: 'learning_goal',
    id,
    event: {
      type: event_type,
      payload:
        event_type === 'status_changed'
          ? { from: existing.status, to: patch.status }
          : { fields: Object.keys(update) },
    },
  });
  return await getLearningGoal(id);
}

export async function snoozeLearningGoal(id: string, until: string, reason: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.learning_goal)
    .set({ snoozed_until: until, snooze_reason: reason })
    .where(eq(handle.schema.learning_goal.id, id));
  await touchEntity({
    type: 'learning_goal',
    id,
    event: { type: 'snoozed', payload: { until, reason } },
  });
  return await getLearningGoal(id);
}

export async function unsnoozeLearningGoal(id: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.learning_goal)
    .set({ snoozed_until: null, snooze_reason: null })
    .where(eq(handle.schema.learning_goal.id, id));
  await touchEntity({ type: 'learning_goal', id, event: { type: 'unsnoozed' } });
  return await getLearningGoal(id);
}
