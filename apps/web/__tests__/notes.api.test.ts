// Integration: GET /api/v1/notes, GET/PATCH/DELETE /api/v1/notes/:id
// Notes become first-class in V2: editable and deletable anywhere they render.

import { getSearch } from '@compass/search';
import { beforeEach, describe, expect, it } from 'vitest';
import * as capturesQ from '../../../packages/db/src/queries/captures.js';
import * as notesQ from '../../../packages/db/src/queries/notes.js';
import * as projectsQ from '../../../packages/db/src/queries/projects.js';
import { createBearer } from '../../../tests/helpers/auth.js';
import { setupTestDb } from '../../../tests/helpers/db.js';
import {
  DELETE as noteDelete,
  GET as noteGet,
  PATCH as notePatch,
} from '../app/api/v1/notes/[id]/route.js';
import { GET as notesList } from '../app/api/v1/notes/route.js';

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('notes API', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('lists notes with filed/unfiled filters', async () => {
    const cap = await capturesQ.createCapture({
      idem_key: 'n-1',
      client_id: 'cli',
      body: 'floating',
      tags: [],
    });
    const project = await projectsQ.createProject({ title: 'host' });
    await capturesQ.createCapture({ idem_key: 'n-2', client_id: 'cli', body: 'to file', tags: [] });
    const filedNote = (await notesQ.listInbox()).find((n) => n.body_markdown === 'to file')!;
    await notesQ.fileNoteToEntity(filedNote.id, { type: 'project', id: project.id });

    const bearer = await createBearer({ scope: 'cli' });
    const mk = (qs: string) =>
      new Request(`http://localhost:3000/api/v1/notes${qs}`, {
        headers: { authorization: bearer.header },
      });

    const all = await notesList(mk('') as never);
    expect(((await all.json()) as { notes: unknown[] }).notes.length).toBe(2);

    const unfiled = await notesList(mk('?filed=unfiled') as never);
    const unfiledJson = (await unfiled.json()) as { notes: Array<{ id: string }> };
    expect(unfiledJson.notes.map((n) => n.id)).toEqual([cap.note_id]);

    const filed = await notesList(mk('?filed=filed') as never);
    const filedJson = (await filed.json()) as { notes: Array<{ id: string }> };
    expect(filedJson.notes.map((n) => n.id)).toEqual([filedNote.id]);
  });

  it('PATCH updates body + title, bumps last_touched_at, and refreshes the search index', async () => {
    const cap = await capturesQ.createCapture({
      idem_key: 'n-3',
      client_id: 'cli',
      body: 'draft',
      tags: [],
    });
    const before = (await notesQ.getNote(cap.note_id))!.last_touched_at;
    await new Promise((r) => setTimeout(r, 5));
    const bearer = await createBearer({ scope: 'cli' });
    const req = new Request(`http://localhost:3000/api/v1/notes/${cap.note_id}`, {
      method: 'PATCH',
      headers: { authorization: bearer.header, 'content-type': 'application/json' },
      body: JSON.stringify({ body_markdown: 'polished', title: 'Named' }),
    });
    const res = await notePatch(req as never, params(cap.note_id));
    expect(res.status).toBe(200);
    const { note } = (await res.json()) as {
      note: { body_markdown: string; title: string | null; last_touched_at: string };
    };
    expect(note.body_markdown).toBe('polished');
    expect(note.title).toBe('Named');
    expect(note.last_touched_at > before).toBe(true);

    // Search index reflects the NEW body.
    const hits = await getSearch().query({ q: 'polished' });
    expect(hits.some((h) => h.entity_id === cap.note_id)).toBe(true);
  });

  it('DELETE removes the note, purges the search index, and 404s on repeat', async () => {
    const cap = await capturesQ.createCapture({
      idem_key: 'n-4',
      client_id: 'cli',
      body: 'ephemeral',
      tags: [],
    });
    // Index it first so the delete has something real to purge.
    await getSearch().indexEntity({
      entity_type: 'note',
      entity_id: cap.note_id,
      title: '',
      body: 'ephemeral',
      tags: [],
    });
    expect((await getSearch().query({ q: 'ephemeral' })).length).toBeGreaterThan(0);
    const bearer = await createBearer({ scope: 'cli' });
    const mk = () =>
      new Request(`http://localhost:3000/api/v1/notes/${cap.note_id}`, {
        method: 'DELETE',
        headers: { authorization: bearer.header },
      });
    const res = await noteDelete(mk() as never, params(cap.note_id));
    expect(res.status).toBe(200);

    // The search index no longer returns the deleted note.
    const hits = await getSearch().query({ q: 'ephemeral' });
    expect(hits.some((h) => h.entity_id === cap.note_id)).toBe(false);

    const getRes = await noteGet(
      new Request(`http://localhost:3000/api/v1/notes/${cap.note_id}`, {
        headers: { authorization: bearer.header },
      }) as never,
      params(cap.note_id),
    );
    expect(getRes.status).toBe(404);

    const again = await noteDelete(mk() as never, params(cap.note_id));
    expect(again.status).toBe(404);
  });
});
