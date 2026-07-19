import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as activityQ from '../queries/activity.js';
import * as projectsQ from '../queries/projects.js';

describe('activity recentPaged', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('pages through the full feed without duplicates or gaps', async () => {
    for (let i = 0; i < 7; i++) {
      await projectsQ.createProject({ title: `p${i}` });
    }
    // 7 'created' events exist. Page size 3 → 3 + 3 + 1.
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await activityQ.recentPaged({ cursor, limit: 3 });
      for (const e of page.events) {
        expect(seen.has(e.id)).toBe(false);
        seen.add(e.id);
      }
      cursor = page.next_cursor;
      pages++;
    } while (cursor && pages < 10);
    expect(seen.size).toBe(7);
    expect(pages).toBe(3);
  });

  it('filters by entity type', async () => {
    await projectsQ.createProject({ title: 'only-projects' });
    const page = await activityQ.recentPaged({ types: ['learning_goal'] });
    expect(page.events).toHaveLength(0);
    const pPage = await activityQ.recentPaged({ types: ['project'] });
    expect(pPage.events.length).toBeGreaterThan(0);
  });
});
