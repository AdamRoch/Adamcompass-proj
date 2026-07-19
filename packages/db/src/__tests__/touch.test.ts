import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as capturesQ from '../queries/captures.js';
import * as notesQ from '../queries/notes.js';
import * as projectsQ from '../queries/projects.js';
import { touchEntity } from '../touch.js';

describe('touchEntity', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('bumps last_touched_at on the target and writes an activity_event with payload', async () => {
    const project = await projectsQ.createProject({ title: 'touched' });
    const before = project.last_touched_at;
    await new Promise((r) => setTimeout(r, 10));
    const { event_id } = await touchEntity({
      type: 'project',
      id: project.id,
      event: { type: 'updated', payload: { fields: ['summary'] } },
    });
    expect(event_id).toHaveLength(26);

    const after = await projectsQ.getProject(project.id);
    expect(after!.last_touched_at > before).toBe(true);

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const evt = raw.prepare('SELECT * FROM activity_event WHERE id = ?').get(event_id) as {
      entity_type: string;
      entity_id: string;
      event_type: string;
      payload_json: string;
      occurred_at: string;
      received_at: string;
    };
    expect(evt.entity_type).toBe('project');
    expect(evt.entity_id).toBe(project.id);
    expect(evt.event_type).toBe('updated');
    expect(JSON.parse(evt.payload_json).fields).toEqual(['summary']);
    expect(evt.occurred_at).toBe(evt.received_at);
  });

  it('supports alsoTouch to bump a parent entity in the same call', async () => {
    const project = await projectsQ.createProject({ title: 'parent' });
    const capture = await capturesQ.createCapture({
      idem_key: 'idem-also',
      client_id: 'cli',
      body: 'child',
      tags: [],
    });
    const before = project.last_touched_at;
    await new Promise((r) => setTimeout(r, 10));
    await touchEntity({
      type: 'note',
      id: capture.note_id,
      event: { type: 'updated' },
      alsoTouch: [{ type: 'project', id: project.id }],
    });
    const after = await projectsQ.getProject(project.id);
    expect(after!.last_touched_at > before).toBe(true);
    const note = await notesQ.getNote(capture.note_id);
    expect(note!.last_touched_at > note!.created_at).toBe(true);
  });

  it('serializes empty payload as {} (so JSON.parse never throws downstream)', async () => {
    const project = await projectsQ.createProject({ title: 'p' });
    const { event_id } = await touchEntity({
      type: 'project',
      id: project.id,
      event: { type: 'unsnoozed' },
    });
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const evt = raw
      .prepare('SELECT payload_json FROM activity_event WHERE id = ?')
      .get(event_id) as { payload_json: string };
    expect(evt.payload_json).toBe('{}');
    expect(() => JSON.parse(evt.payload_json)).not.toThrow();
  });
});
