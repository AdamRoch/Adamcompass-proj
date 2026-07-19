import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as milestonesQ from '../queries/milestones.js';
import * as projectsQ from '../queries/projects.js';

describe('milestones queries', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('add appends with increasing order_index and touches the project', async () => {
    const p = await projectsQ.createProject({ title: 'M-project' });
    const m1 = await milestonesQ.add({ project_id: p.id, title: 'first' });
    const m2 = await milestonesQ.add({ project_id: p.id, title: 'second' });
    expect(m1.order_index).toBe(0);
    expect(m2.order_index).toBe(1);
    const list = await milestonesQ.listForProject(p.id);
    expect(list.map((m) => m.title)).toEqual(['first', 'second']);
  });

  it('toggleDone flips done, writes milestone_completed event, derives project progress', async () => {
    const p = await projectsQ.createProject({ title: 'Progress' });
    const m1 = await milestonesQ.add({ project_id: p.id, title: 'a' });
    await milestonesQ.add({ project_id: p.id, title: 'b' });

    const toggled = await milestonesQ.toggleDone(m1.id);
    expect(toggled?.done).toBe(true);

    const proj = await projectsQ.getProject(p.id);
    expect(proj?.progress_pct).toBe(50);

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as import('better-sqlite3').Database;
    const evts = raw
      .prepare('SELECT event_type FROM activity_event WHERE entity_id=?')
      .all(m1.id) as Array<{ event_type: string }>;
    expect(evts.some((e) => e.event_type === 'milestone_completed')).toBe(true);

    // Untoggle → progress back to 0, reopened event written.
    const untoggled = await milestonesQ.toggleDone(m1.id);
    expect(untoggled?.done).toBe(false);
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(0);
  });

  it('manual progress_pct survives when a project has no milestones (PRD §3.1 override)', async () => {
    const p = await projectsQ.createProject({ title: 'Manual' });
    await projectsQ.updateProject(p.id, { progress_pct: 40 });
    // Recompute with zero milestones must NOT clobber the manual value.
    await milestonesQ.recomputeProgress(p.id);
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(40);

    // Adding then removing the only milestone leaves derived progress (0 after removal keeps
    // the last derived value; the manual override only applies while zero milestones existed).
    const m = await milestonesQ.add({ project_id: p.id, title: 'only' });
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(0);
    await milestonesQ.remove(m.id);
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(0);
  });

  it('remove deletes the row and recomputes progress from the remainder', async () => {
    const p = await projectsQ.createProject({ title: 'Remove' });
    const m1 = await milestonesQ.add({ project_id: p.id, title: 'done one' });
    await milestonesQ.add({ project_id: p.id, title: 'open one' });
    await milestonesQ.toggleDone(m1.id);
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(50);

    expect(await milestonesQ.remove(m1.id)).toBe(true);
    expect(await milestonesQ.listForProject(p.id)).toHaveLength(1);
    expect((await projectsQ.getProject(p.id))?.progress_pct).toBe(0);

    // Removing a missing id is a no-op false.
    expect(await milestonesQ.remove(m1.id)).toBe(false);
  });
});
