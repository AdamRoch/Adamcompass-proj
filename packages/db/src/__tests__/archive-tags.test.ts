import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as learningQ from '../queries/learning.js';
import * as projectsQ from '../queries/projects.js';
import * as tagsQ from '../queries/tags.js';

describe('archive / restore', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('project archive stores the prior stage and restore returns to it', async () => {
    const p = await projectsQ.createProject({ title: 'arch', stage: 'building' });
    const archived = await projectsQ.archiveProject(p.id, 'lost steam');
    expect(archived?.stage).toBe('archived');

    const restored = await projectsQ.restoreProject(p.id);
    expect(restored?.stage).toBe('building');
  });

  it('learning goal archive/restore round-trips status', async () => {
    const g = await learningQ.createLearningGoal({ title: 'topic', status: 'in_progress' });
    await learningQ.archiveLearningGoal(g!.id);
    expect((await learningQ.getLearningGoal(g!.id))?.status).toBe('archived');
    const restored = await learningQ.restoreLearningGoal(g!.id);
    expect(restored?.status).toBe('in_progress');
  });

  it('archived items leave the momentum strip even though archiving touches them', async () => {
    const dashboardQ = await import('../queries/dashboard.js');
    const p = await projectsQ.createProject({ title: 'soon-archived', stage: 'building' });
    expect((await dashboardQ.momentumStrip()).some((m) => m.id === p.id)).toBe(true);
    await projectsQ.archiveProject(p.id);
    expect((await dashboardQ.momentumStrip()).some((m) => m.id === p.id)).toBe(false);
  });

  it('restore on a non-archived project is a no-op', async () => {
    const p = await projectsQ.createProject({ title: 'noop', stage: 'prd' });
    const same = await projectsQ.restoreProject(p.id);
    expect(same?.stage).toBe('prd');
  });
});

describe('tag merge / delete', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('merge re-points taggings and deletes the source tag', async () => {
    // pOnlyA carries ONLY the source tag — the merge must re-point it, not just delete it.
    const pOnlyA = await projectsQ.createProject({ title: 'only-source-tagged' });
    const pBoth = await projectsQ.createProject({ title: 'both-tagged' });
    const a = await tagsQ.ensure('ml');
    const b = await tagsQ.ensure('machine-learning');
    await tagsQ.attach(a.id, 'project', pOnlyA.id);
    await tagsQ.attach(a.id, 'project', pBoth.id);
    await tagsQ.attach(b.id, 'project', pBoth.id);

    expect(await tagsQ.merge(a.id, b.id)).toBe(true);

    const remaining = await tagsQ.listWithCounts();
    expect(remaining.map((t) => t.name)).toEqual(['machine-learning']);
    // Both projects now tagged 'machine-learning': the re-pointed one + the pre-existing one.
    expect(remaining[0]?.count).toBe(2);
    expect((await tagsQ.tagsForEntity('project', pOnlyA.id)).map((t) => t.name)).toEqual([
      'machine-learning',
    ]);
  });

  it('deleting a tagged note cleans its taggings so counts stay honest and tags stay deletable', async () => {
    const notesQ = await import('../queries/notes.js');
    const capturesQ = await import('../queries/captures.js');
    const cap = await capturesQ.createCapture({
      idem_key: 'tag-note-1',
      client_id: 'test',
      body: 'tagged note',
      tags: [],
    });
    const t = await tagsQ.ensure('note-only-tag');
    await tagsQ.attach(t.id, 'note', cap.note_id);
    expect(await tagsQ.removeIfUnused(t.id)).toBe(false);

    await notesQ.deleteNote(cap.note_id);
    const counts = await tagsQ.listWithCounts();
    expect(counts.find((x) => x.name === 'note-only-tag')?.count).toBe(0);
    expect(await tagsQ.removeIfUnused(t.id)).toBe(true);
  });

  it('removeIfUnused refuses tags in use and deletes free ones', async () => {
    const p = await projectsQ.createProject({ title: 'tagged2' });
    const used = await tagsQ.ensure('busy');
    const free = await tagsQ.ensure('idle');
    await tagsQ.attach(used.id, 'project', p.id);

    expect(await tagsQ.removeIfUnused(used.id)).toBe(false);
    expect(await tagsQ.removeIfUnused(free.id)).toBe(true);
    expect((await tagsQ.list()).map((t) => t.name)).toEqual(['busy']);
  });
});
