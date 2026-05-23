import { and, desc, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import {
  calendarDaysBetween,
  daysAgoIso,
  nowIso,
  startOfDayInTz,
  type Settings,
} from '@compass/shared';
import { getDb } from '../index.js';
import { getSettings } from './settings.js';

export interface MomentumItem {
  entity_type: 'project' | 'learning_goal';
  id: string;
  title: string;
  last_touched_at: string;
  stage_or_status: string;
  snoozed_until: string | null;
}

export interface StalledItem extends MomentumItem {
  days_since_touch: number;
  threshold_days: number;
}

export async function momentumStrip(days = 7, limit = 20): Promise<MomentumItem[]> {
  const handle = getDb();
  const since = daysAgoIso(days);
  const projects = await handle.db
    .select({
      id: handle.schema.project.id,
      title: handle.schema.project.title,
      last_touched_at: handle.schema.project.last_touched_at,
      stage: handle.schema.project.stage,
      snoozed_until: handle.schema.project.snoozed_until,
    })
    .from(handle.schema.project)
    .where(gte(handle.schema.project.last_touched_at, since));
  const goals = await handle.db
    .select({
      id: handle.schema.learning_goal.id,
      title: handle.schema.learning_goal.title,
      last_touched_at: handle.schema.learning_goal.last_touched_at,
      status: handle.schema.learning_goal.status,
      snoozed_until: handle.schema.learning_goal.snoozed_until,
    })
    .from(handle.schema.learning_goal)
    .where(gte(handle.schema.learning_goal.last_touched_at, since));

  const items: MomentumItem[] = [
    ...projects.map((p) => ({
      entity_type: 'project' as const,
      id: p.id,
      title: p.title,
      last_touched_at: p.last_touched_at,
      stage_or_status: p.stage,
      snoozed_until: p.snoozed_until,
    })),
    ...goals.map((g) => ({
      entity_type: 'learning_goal' as const,
      id: g.id,
      title: g.title,
      last_touched_at: g.last_touched_at,
      stage_or_status: g.status,
      snoozed_until: g.snoozed_until,
    })),
  ];
  // Stable descending sort on last_touched_at (ISO strings sort lexicographically).
  items.sort((a, b) => b.last_touched_at.localeCompare(a.last_touched_at));
  return items.slice(0, limit);
}

export async function needsAttention(): Promise<StalledItem[]> {
  const handle = getDb();
  const now = nowIso();
  const settings: Settings = await getSettings();
  const items: StalledItem[] = [];

  // Projects
  const pthreshDefault = settings.default_stall_threshold_project_days;
  const pCutoff = daysAgoIso(pthreshDefault);
  const projects = await handle.db
    .select()
    .from(handle.schema.project)
    .where(
      and(
        lt(handle.schema.project.last_touched_at, pCutoff),
        or(
          isNull(handle.schema.project.snoozed_until),
          lt(handle.schema.project.snoozed_until, now),
        )!,
        or(
          eq(handle.schema.project.stage, 'idea'),
          eq(handle.schema.project.stage, 'prd'),
          eq(handle.schema.project.stage, 'building'),
          eq(handle.schema.project.stage, 'review'),
        )!,
      ),
    );
  for (const p of projects) {
    const threshold = p.stall_threshold_days ?? pthreshDefault;
    const days = calendarDaysBetween(p.last_touched_at, now, settings.timezone);
    if (days < threshold) continue;
    items.push({
      entity_type: 'project',
      id: p.id,
      title: p.title,
      last_touched_at: p.last_touched_at,
      stage_or_status: p.stage,
      snoozed_until: p.snoozed_until,
      days_since_touch: days,
      threshold_days: threshold,
    });
  }

  // Learning goals
  const lthreshDefault = settings.default_stall_threshold_learning_days;
  const lCutoff = daysAgoIso(lthreshDefault);
  const goals = await handle.db
    .select()
    .from(handle.schema.learning_goal)
    .where(
      and(
        lt(handle.schema.learning_goal.last_touched_at, lCutoff),
        or(
          isNull(handle.schema.learning_goal.snoozed_until),
          lt(handle.schema.learning_goal.snoozed_until, now),
        )!,
        or(
          eq(handle.schema.learning_goal.status, 'curious'),
          eq(handle.schema.learning_goal.status, 'in_progress'),
        )!,
      ),
    );
  for (const g of goals) {
    const threshold = g.stall_threshold_days ?? lthreshDefault;
    const days = calendarDaysBetween(g.last_touched_at, now, settings.timezone);
    if (days < threshold) continue;
    items.push({
      entity_type: 'learning_goal',
      id: g.id,
      title: g.title,
      last_touched_at: g.last_touched_at,
      stage_or_status: g.status,
      snoozed_until: g.snoozed_until,
      days_since_touch: days,
      threshold_days: threshold,
    });
  }

  items.sort((a, b) => b.days_since_touch - a.days_since_touch);
  return items;
}

export async function thisWeek(days = 7) {
  const handle = getDb();
  const settings: Settings = await getSettings();
  // Compute "today" and the upper bound in the user's local timezone so the window doesn't
  // shift by ±1 day around midnight in zones away from UTC.
  const nowIsoStr = nowIso();
  const startOfTodayLocal = startOfDayInTz(nowIsoStr, settings.timezone);
  const endLocal = new Date(startOfTodayLocal.getTime() + days * 24 * 60 * 60 * 1000);
  const startDate = toIsoDate(startOfTodayLocal);
  const endDate = toIsoDate(endLocal);

  const projects = await handle.db
    .select()
    .from(handle.schema.project)
    .where(
      and(
        isNotNull(handle.schema.project.target_date),
        gte(handle.schema.project.target_date, startDate),
        lt(handle.schema.project.target_date, endDate),
      ),
    );
  const goals = await handle.db
    .select()
    .from(handle.schema.learning_goal)
    .where(
      and(
        isNotNull(handle.schema.learning_goal.target_date),
        gte(handle.schema.learning_goal.target_date, startDate),
        lt(handle.schema.learning_goal.target_date, endDate),
      ),
    );
  return { projects, learning_goals: goals };
}

// Helpers
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DashboardCounts {
  projects_by_stage: Record<string, number>;
  learning_by_status: Record<string, number>;
  reading_by_status: Record<string, number>;
  inbox_count: number;
}

export async function counts(): Promise<DashboardCounts> {
  const handle = getDb();
  const projects = await handle.db.select().from(handle.schema.project);
  const goals = await handle.db.select().from(handle.schema.learning_goal);
  const resources = await handle.db.select().from(handle.schema.resource);
  const inbox = await handle.db
    .select()
    .from(handle.schema.note)
    .where(isNull(handle.schema.note.entity_id));

  const projects_by_stage: Record<string, number> = {};
  for (const p of projects) {
    projects_by_stage[p.stage] = (projects_by_stage[p.stage] ?? 0) + 1;
  }
  const learning_by_status: Record<string, number> = {};
  for (const g of goals) {
    learning_by_status[g.status] = (learning_by_status[g.status] ?? 0) + 1;
  }
  const reading_by_status: Record<string, number> = {};
  for (const r of resources) {
    reading_by_status[r.reading_status] = (reading_by_status[r.reading_status] ?? 0) + 1;
  }

  return {
    projects_by_stage,
    learning_by_status,
    reading_by_status,
    inbox_count: inbox.length,
  };
}

