import { eq } from 'drizzle-orm';
import { newUlid, nowIso } from '@compass/shared';
import { getDb } from '../index.js';

export interface ChecklistItemRow {
  id: string;
  learning_goal_id: string;
  title: string;
  done: boolean;
  order_index: number;
  created_at: string;
  last_touched_at: string;
}

export async function listForGoal(goalId: string): Promise<ChecklistItemRow[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.checklist_item)
    .where(eq(handle.schema.checklist_item.learning_goal_id, goalId))
    .orderBy(handle.schema.checklist_item.order_index);
  return rows as ChecklistItemRow[];
}

export async function toggleDone(id: string): Promise<ChecklistItemRow | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.checklist_item)
    .where(eq(handle.schema.checklist_item.id, id))
    .limit(1);
  const cur = rows[0];
  if (!cur) return null;
  const next = !cur.done;
  await handle.db
    .update(handle.schema.checklist_item)
    .set({ done: next, last_touched_at: nowIso() })
    .where(eq(handle.schema.checklist_item.id, id));
  return { ...(cur as ChecklistItemRow), done: next };
}

export async function add(input: {
  learning_goal_id: string;
  title: string;
}): Promise<ChecklistItemRow> {
  const handle = getDb();
  const existing = await handle.db
    .select({ idx: handle.schema.checklist_item.order_index })
    .from(handle.schema.checklist_item)
    .where(eq(handle.schema.checklist_item.learning_goal_id, input.learning_goal_id));
  const nextIdx = existing.reduce((m, r) => Math.max(m, r.idx ?? 0), -1) + 1;
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.checklist_item).values({
    id,
    learning_goal_id: input.learning_goal_id,
    title: input.title.slice(0, 500),
    done: false,
    order_index: nextIdx,
    created_at: now,
    last_touched_at: now,
  });
  // Touch parent goal so it reads as fresh activity
  await handle.db
    .update(handle.schema.learning_goal)
    .set({ last_touched_at: now })
    .where(eq(handle.schema.learning_goal.id, input.learning_goal_id));
  return {
    id,
    learning_goal_id: input.learning_goal_id,
    title: input.title.slice(0, 500),
    done: false,
    order_index: nextIdx,
    created_at: now,
    last_touched_at: now,
  };
}
