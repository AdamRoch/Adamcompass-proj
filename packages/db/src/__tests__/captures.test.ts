import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as capturesQ from '../queries/captures.js';
import * as notesQ from '../queries/notes.js';

describe('createCapture', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('writes a note in the inbox (entity_id is null) and bumps last_touched_at', async () => {
    const before = new Date().toISOString();
    const res = await capturesQ.createCapture({
      idem_key: 'idem-aaaa-bbbb-1111',
      client_id: 'cli-test',
      body: 'a fresh idea',
      type_hint: 'idea',
      tags: [],
    });
    expect(res.duplicate).toBe(false);
    expect(res.note_id).toHaveLength(26);

    const note = await notesQ.getNote(res.note_id);
    expect(note).toBeTruthy();
    expect(note!.body_markdown).toBe('a fresh idea');
    expect(note!.entity_id).toBeNull();
    expect(note!.entity_type).toBeNull();
    expect(note!.inbox_type_hint).toBe('idea');
    expect(note!.created_at >= before).toBe(true);
    expect(note!.last_touched_at).toBe(note!.created_at);
  });

  it('dedupes on (client_id, idem_key)', async () => {
    const first = await capturesQ.createCapture({
      idem_key: 'idem-dup-1',
      client_id: 'cli-dup',
      body: 'first',
      tags: [],
    });
    const second = await capturesQ.createCapture({
      idem_key: 'idem-dup-1',
      client_id: 'cli-dup',
      body: 'second body (should be ignored)',
      tags: [],
    });
    expect(second.duplicate).toBe(true);
    expect(second.note_id).toBe(first.note_id);

    // Only one note row should exist for this client/key pair.
    const note = await notesQ.getNote(first.note_id);
    expect(note!.body_markdown).toBe('first');
  });

  it('treats the same idem_key from different clients as distinct captures', async () => {
    const a = await capturesQ.createCapture({
      idem_key: 'shared-key',
      client_id: 'cli-a',
      body: 'from a',
      tags: [],
    });
    const b = await capturesQ.createCapture({
      idem_key: 'shared-key',
      client_id: 'cli-b',
      body: 'from b',
      tags: [],
    });
    expect(a.note_id).not.toBe(b.note_id);
    expect(b.duplicate).toBe(false);
  });

  it('persists supplied tags to the tag + tagging tables', async () => {
    setupTestDb(); // fresh DB for this assertion of counts
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const res = await capturesQ.createCapture({
      idem_key: 'idem-tagged',
      client_id: 'cli-tagged',
      body: 'tagged note',
      tags: ['Area/AI', 'urgent'],
    });
    const tagRows = raw.prepare('SELECT name FROM tag ORDER BY name').all() as Array<{
      name: string;
    }>;
    expect(tagRows.map((r) => r.name)).toEqual(['area/ai', 'urgent']);

    const taggings = raw
      .prepare('SELECT count(*) as c FROM tagging WHERE entity_id = ?')
      .get(res.note_id) as { c: number };
    expect(taggings.c).toBe(2);
  });

  it('writes a created activity_event for the new note', async () => {
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const res = await capturesQ.createCapture({
      idem_key: 'idem-evt',
      client_id: 'cli-evt',
      body: 'event coverage',
      tags: [],
    });
    const evts = raw
      .prepare(
        'SELECT event_type, entity_type, entity_id, payload_json FROM activity_event WHERE entity_id = ?',
      )
      .all(res.note_id) as Array<{
      event_type: string;
      entity_type: string;
      entity_id: string;
      payload_json: string;
    }>;
    const created = evts.find((e) => e.event_type === 'created');
    expect(created).toBeTruthy();
    expect(created!.entity_type).toBe('note');
    const payload = JSON.parse(created!.payload_json);
    expect(payload.source).toBe('capture');
    expect(payload.client_id).toBe('cli-evt');
  });
});
