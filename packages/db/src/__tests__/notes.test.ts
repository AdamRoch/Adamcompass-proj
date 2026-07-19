import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as capturesQ from '../queries/captures.js';
import * as notesQ from '../queries/notes.js';
import * as projectsQ from '../queries/projects.js';

describe('fileNoteToEntity', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('attaches the note to the target, touches parent, and writes note_added on the parent', async () => {
    const capture = await capturesQ.createCapture({
      idem_key: 'idem-file-1',
      client_id: 'cli-file',
      body: 'thoughts about auth',
      tags: [],
    });
    const project = await projectsQ.createProject({ title: 'Auth hardening' });
    const originalProjectTouched = project.last_touched_at;
    await new Promise((r) => setTimeout(r, 10));

    const filed = await notesQ.fileNoteToEntity(capture.note_id, {
      type: 'project',
      id: project.id,
    });
    expect(filed!.entity_type).toBe('project');
    expect(filed!.entity_id).toBe(project.id);

    // Project's last_touched_at should advance because we touched it as a parent.
    const updatedProject = await projectsQ.getProject(project.id);
    expect(updatedProject!.last_touched_at > originalProjectTouched).toBe(true);

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const projEvts = raw
      .prepare(
        `SELECT event_type, payload_json FROM activity_event WHERE entity_type='project' AND entity_id=?`,
      )
      .all(project.id) as Array<{ event_type: string; payload_json: string }>;
    const added = projEvts.find((e) => e.event_type === 'note_added');
    expect(added).toBeTruthy();
    const payload = JSON.parse(added!.payload_json);
    expect(payload.note_id).toBe(capture.note_id);

    const noteEvts = raw
      .prepare(`SELECT event_type FROM activity_event WHERE entity_type='note' AND entity_id=?`)
      .all(capture.note_id) as Array<{ event_type: string }>;
    expect(noteEvts.some((e) => e.event_type === 'filed')).toBe(true);
  });

  it('updateNoteBody bumps last_touched_at and writes an updated event', async () => {
    const capture = await capturesQ.createCapture({
      idem_key: 'idem-update',
      client_id: 'cli',
      body: 'initial',
      tags: [],
    });
    const before = (await notesQ.getNote(capture.note_id))!.last_touched_at;
    await new Promise((r) => setTimeout(r, 10));
    const updated = await notesQ.updateNoteBody(capture.note_id, 'revised', 'title?');
    expect(updated!.body_markdown).toBe('revised');
    expect(updated!.title).toBe('title?');
    expect(updated!.last_touched_at > before).toBe(true);
  });

  it('listInbox only returns unfiled notes', async () => {
    const a = await capturesQ.createCapture({
      idem_key: 'idem-l1',
      client_id: 'cli',
      body: 'a',
      tags: [],
    });
    const b = await capturesQ.createCapture({
      idem_key: 'idem-l2',
      client_id: 'cli',
      body: 'b',
      tags: [],
    });
    const project = await projectsQ.createProject({ title: 'home' });
    await notesQ.fileNoteToEntity(a.note_id, { type: 'project', id: project.id });

    const inbox = await notesQ.listInbox();
    const ids = inbox.map((n) => n.id);
    expect(ids).toContain(b.note_id);
    expect(ids).not.toContain(a.note_id);
  });
});
