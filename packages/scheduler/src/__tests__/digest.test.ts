import { addDaysIso, nowIso } from '@compass/shared';
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as capturesQ from '../../../db/src/queries/captures.js';
import * as learningQ from '../../../db/src/queries/learning.js';
import * as projectsQ from '../../../db/src/queries/projects.js';
import { renderDigest } from '../digest.js';

async function backdateProject(id: string, iso: string) {
  const handle = (await import('@compass/db')).getDb();
  const raw = handle.raw as Database.Database;
  raw.prepare('UPDATE project SET last_touched_at = ? WHERE id = ?').run(iso, id);
}

describe('renderDigest', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('produces the canonical three-section layout (Momentum / Needs attention / This week)', async () => {
    // Set up: 1 fresh project, 1 stalled project, 1 with target this week.
    await projectsQ.createProject({ title: 'momentum project' });
    const stale = await projectsQ.createProject({ title: 'stalled project' });
    await backdateProject(stale.id, addDaysIso(nowIso(), -7));
    await projectsQ.createProject({
      title: 'targeted project',
      target_date: nowIso().slice(0, 10), // today
    });

    const md = await renderDigest({ tz: 'UTC' });
    expect(md).toMatch(/^Compass — /m);
    expect(md).toMatch(/\*Momentum/);
    expect(md).toMatch(/\*Needs attention/);
    expect(md).toMatch(/\*This week/);

    // Order: Momentum section before Needs attention before This week.
    const idxMomentum = md.indexOf('*Momentum');
    const idxStall = md.indexOf('*Needs attention');
    const idxWeek = md.indexOf('*This week');
    expect(idxMomentum).toBeLessThan(idxStall);
    expect(idxStall).toBeLessThan(idxWeek);

    // The fresh project should appear under Momentum, stalled project under Needs attention.
    expect(md).toContain('momentum project');
    expect(md).toContain('stalled project');
    expect(md).toContain('targeted project');
  });

  it('renders the empty-state lines when nothing was touched', async () => {
    const md = await renderDigest({ tz: 'UTC' });
    // The implementation Markdown-escapes inner periods for Telegram, so substrings rather than
    // exact line matches.
    expect(md).toContain('Nothing touched this week');
    expect(md).toContain('All current');
    expect(md).toContain('No targets this week');
  });

  it('appends the summary footer with inbox/projects/learning counts', async () => {
    await projectsQ.createProject({ title: 'a' });
    await learningQ.createLearningGoal({ title: 'b' });
    await capturesQ.createCapture({
      idem_key: 'idem-d-1',
      client_id: 'cli',
      body: 'inbox',
      type_hint: 'note',
      tags: [],
    });
    const md = await renderDigest({ tz: 'UTC' });
    expect(md).toMatch(/in inbox/);
    expect(md).toMatch(/projects/);
    expect(md).toMatch(/learning goals/);
  });

  it('snapshot of the empty-state output is stable', async () => {
    const md = await renderDigest({ tz: 'UTC' });
    // Date varies by run; replace the heading line before snapshotting to keep it deterministic.
    const normalized = md.replace(/^Compass — .+$/m, 'Compass — <date>');
    expect(normalized).toMatchSnapshot();
  });
});
