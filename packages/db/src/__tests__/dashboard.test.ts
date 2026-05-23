import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import { addDaysIso, newUlid, nowIso } from '@compass/shared';
import * as projectsQ from '../queries/projects.js';
import * as learningQ from '../queries/learning.js';
import * as dashboardQ from '../queries/dashboard.js';

/**
 * Backdate a project's last_touched_at without going through the touch helper, so we can simulate
 * staleness without waiting real time.
 */
async function backdateProject(id: string, iso: string) {
  const handle = (await import('@compass/db')).getDb();
  const raw = handle.raw as Database.Database;
  raw.prepare(`UPDATE project SET last_touched_at = ? WHERE id = ?`).run(iso, id);
}

async function backdateLearning(id: string, iso: string) {
  const handle = (await import('@compass/db')).getDb();
  const raw = handle.raw as Database.Database;
  raw.prepare(`UPDATE learning_goal SET last_touched_at = ? WHERE id = ?`).run(iso, id);
}

describe('needsAttention', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('flags projects past the default 3-day threshold', async () => {
    const fresh = await projectsQ.createProject({ title: 'fresh' });
    const stale = await projectsQ.createProject({ title: 'stale' });
    await backdateProject(stale.id, addDaysIso(nowIso(), -5));

    const result = await dashboardQ.needsAttention();
    const ids = result.map((r) => r.id);
    expect(ids).toContain(stale.id);
    expect(ids).not.toContain(fresh.id);
  });

  it('honors snoozed_until (skip while snoozed)', async () => {
    const p = await projectsQ.createProject({ title: 'sleepy' });
    await backdateProject(p.id, addDaysIso(nowIso(), -5));
    await projectsQ.snoozeProject(p.id, addDaysIso(nowIso(), 3), 'on vacation');
    // Snooze writes a touch event, so backdate AGAIN to keep stale:
    await backdateProject(p.id, addDaysIso(nowIso(), -5));

    const result = await dashboardQ.needsAttention();
    expect(result.find((r) => r.id === p.id)).toBeUndefined();
  });

  it('respects per-entity threshold override', async () => {
    const lenient = await projectsQ.createProject({ title: 'lenient' });
    // override to 30 days; even though last touched 5d ago, it shouldn't fire
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    raw
      .prepare(`UPDATE project SET stall_threshold_days = 30, last_touched_at = ? WHERE id = ?`)
      .run(addDaysIso(nowIso(), -5), lenient.id);

    const result = await dashboardQ.needsAttention();
    expect(result.find((r) => r.id === lenient.id)).toBeUndefined();
  });

  it('excludes archived projects (stage filter)', async () => {
    const dead = await projectsQ.createProject({ title: 'archived dead' });
    await backdateProject(dead.id, addDaysIso(nowIso(), -10));
    await projectsQ.archiveProject(dead.id);
    await backdateProject(dead.id, addDaysIso(nowIso(), -10));

    const result = await dashboardQ.needsAttention();
    expect(result.find((r) => r.id === dead.id)).toBeUndefined();
  });

  it('includes learning goals past 2-day threshold but excludes completed ones', async () => {
    const lg = await learningQ.createLearningGoal({ title: 'distributed systems' });
    await backdateLearning(lg.id, addDaysIso(nowIso(), -4));
    const done = await learningQ.createLearningGoal({
      title: 'finished topic',
      status: 'completed',
    });
    await backdateLearning(done.id, addDaysIso(nowIso(), -10));

    const result = await dashboardQ.needsAttention();
    const ids = result.map((r) => r.id);
    expect(ids).toContain(lg.id);
    expect(ids).not.toContain(done.id);
  });
});

describe('momentumStrip', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('returns only entities touched within the last N days, newest first', async () => {
    const recent = await projectsQ.createProject({ title: 'today' });
    const old = await projectsQ.createProject({ title: 'old' });
    await backdateProject(old.id, addDaysIso(nowIso(), -20));

    const result = await dashboardQ.momentumStrip(7, 20);
    const ids = result.map((r) => r.id);
    expect(ids).toContain(recent.id);
    expect(ids).not.toContain(old.id);
  });

  it('respects the limit param', async () => {
    for (let i = 0; i < 5; i++) {
      await projectsQ.createProject({ title: `p${i}` });
    }
    const result = await dashboardQ.momentumStrip(7, 2);
    expect(result.length).toBe(2);
  });

  it('mixes projects and learning_goals into one strip', async () => {
    const p = await projectsQ.createProject({ title: 'p' });
    const lg = await learningQ.createLearningGoal({ title: 'lg' });
    const result = await dashboardQ.momentumStrip(7, 20);
    const types = new Set(result.map((r) => r.entity_type));
    expect(types.has('project')).toBe(true);
    expect(types.has('learning_goal')).toBe(true);
    expect(result.some((r) => r.id === p.id)).toBe(true);
    expect(result.some((r) => r.id === lg.id)).toBe(true);
  });
});
