// Integration: GET /api/v1/inbox and POST /api/v1/inbox/:id/file
// The file route moves a note from the inbox to a target entity and writes an activity_event on
// both the note and the parent (per packages/db/src/queries/notes.ts).

import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../tests/helpers/db.js';
import { createBearer } from '../../../tests/helpers/auth.js';
import { GET as inboxGet } from '../app/api/v1/inbox/route.js';
import { POST as filePost } from '../app/api/v1/inbox/[id]/file/route.js';
import * as capturesQ from '../../../packages/db/src/queries/captures.js';
import * as projectsQ from '../../../packages/db/src/queries/projects.js';
import Database from 'better-sqlite3';

describe('GET /api/v1/inbox', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('returns all unfiled notes in created_at DESC order', async () => {
    await capturesQ.createCapture({
      idem_key: 'idem-i1',
      client_id: 'cli',
      body: 'older',
      tags: [],
    });
    // tiny delay so created_at differs
    await new Promise((r) => setTimeout(r, 10));
    await capturesQ.createCapture({
      idem_key: 'idem-i2',
      client_id: 'cli',
      body: 'newer',
      tags: [],
    });

    const bearer = await createBearer({ scope: 'cli' });
    const req = new Request('http://localhost:3000/api/v1/inbox', {
      headers: { authorization: bearer.header },
    });
    const res = await inboxGet(req as never);
    expect(res.status).toBe(200);
    const { notes } = (await res.json()) as { notes: Array<{ body_markdown: string }> };
    expect(notes.length).toBe(2);
    expect(notes[0]!.body_markdown).toBe('newer');
    expect(notes[1]!.body_markdown).toBe('older');
  });
});

describe('POST /api/v1/inbox/:id/file', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('files an unfiled note onto an existing project and writes events on both sides', async () => {
    const capture = await capturesQ.createCapture({
      idem_key: 'idem-file-api-1',
      client_id: 'cli',
      body: 'a thought',
      tags: [],
    });
    const project = await projectsQ.createProject({ title: 'home' });
    const bearer = await createBearer({ scope: 'cli' });
    const req = new Request(
      `http://localhost:3000/api/v1/inbox/${capture.note_id}/file`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: bearer.header,
        },
        body: JSON.stringify({
          target: 'existing',
          target_type: 'project',
          target_id: project.id,
        }),
      },
    );
    const res = await filePost(req as never, {
      params: Promise.resolve({ id: capture.note_id }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      note: { entity_id: string; entity_type: string };
      target: { type: string; id: string };
    };
    expect(json.note.entity_id).toBe(project.id);
    expect(json.note.entity_type).toBe('project');
    expect(json.target.type).toBe('project');

    // Activity events should exist on both the note (filed) and the project (note_added).
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const noteEvts = raw
      .prepare(`SELECT event_type FROM activity_event WHERE entity_type='note' AND entity_id=?`)
      .all(capture.note_id) as Array<{ event_type: string }>;
    expect(noteEvts.some((e) => e.event_type === 'filed')).toBe(true);
    const projEvts = raw
      .prepare(`SELECT event_type FROM activity_event WHERE entity_type='project' AND entity_id=?`)
      .all(project.id) as Array<{ event_type: string }>;
    expect(projEvts.some((e) => e.event_type === 'note_added')).toBe(true);
  });

  it('creates a new project and files the note onto it when target=new_project', async () => {
    const capture = await capturesQ.createCapture({
      idem_key: 'idem-file-new',
      client_id: 'cli',
      body: 'a seed idea',
      tags: [],
    });
    const bearer = await createBearer({ scope: 'cli' });
    const req = new Request(
      `http://localhost:3000/api/v1/inbox/${capture.note_id}/file`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: bearer.header,
        },
        body: JSON.stringify({ target: 'new_project', title: 'Sprouted from inbox' }),
      },
    );
    const res = await filePost(req as never, {
      params: Promise.resolve({ id: capture.note_id }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      note: { entity_id: string; entity_type: string };
      target: { type: string; id: string };
    };
    expect(json.target.type).toBe('project');
    expect(json.note.entity_id).toBe(json.target.id);

    const created = await projectsQ.getProject(json.target.id);
    expect(created!.title).toBe('Sprouted from inbox');
  });

  it('returns 404 when filing a non-existent note', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const projectId = (await projectsQ.createProject({ title: 'tgt' })).id;
    const bogusNoteId = '01ABCDEFGHJKMNPQRSTUVWXYZ0';
    const req = new Request(
      `http://localhost:3000/api/v1/inbox/${bogusNoteId}/file`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: bearer.header,
        },
        body: JSON.stringify({
          target: 'existing',
          target_type: 'project',
          target_id: projectId,
        }),
      },
    );
    const res = await filePost(req as never, {
      params: Promise.resolve({ id: bogusNoteId }),
    });
    expect(res.status).toBe(404);
  });
});
