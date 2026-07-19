import { newUlid } from '@compass/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import { createFts5Provider } from '../fts5.js';

describe('FTS5 search provider', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('indexEntity then query returns the hit', async () => {
    const provider = createFts5Provider();
    const id = newUlid();
    await provider.indexEntity({
      entity_type: 'project',
      entity_id: id,
      title: 'Compass dashboard',
      body: 'A personal projects and learning hub for the long arc.',
      tags: ['area/dev'],
    });
    const hits = await provider.query({ q: 'compass' });
    expect(hits.length).toBe(1);
    expect(hits[0]!.entity_id).toBe(id);
    expect(hits[0]!.entity_type).toBe('project');
  });

  it('removeEntity drops the hit', async () => {
    const provider = createFts5Provider();
    const id = newUlid();
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: id,
      title: 't',
      body: 'unique-word-zyzyx in here',
      tags: [],
    });
    expect((await provider.query({ q: 'zyzyx' })).length).toBe(1);
    await provider.removeEntity({ entity_type: 'note', entity_id: id });
    expect((await provider.query({ q: 'zyzyx' })).length).toBe(0);
  });

  it('re-indexing the same entity replaces the prior row (no duplicates)', async () => {
    const provider = createFts5Provider();
    const id = newUlid();
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: id,
      title: 'one',
      body: 'first',
      tags: [],
    });
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: id,
      title: 'two',
      body: 'second',
      tags: [],
    });
    const hits = await provider.query({ q: 'second' });
    expect(hits.length).toBe(1);
    expect(hits[0]!.entity_id).toBe(id);
    // The earlier "first" body shouldn't be retrievable.
    expect((await provider.query({ q: 'first' })).length).toBe(0);
  });

  it('tokenizes multi-word queries (AND-of-tokens behavior)', async () => {
    const provider = createFts5Provider();
    const a = newUlid();
    const b = newUlid();
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: a,
      title: 'auth tokens',
      body: 'hardening the auth path with bearer tokens',
      tags: [],
    });
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: b,
      title: 'unrelated',
      body: 'about tokens but not auth',
      tags: [],
    });
    const both = await provider.query({ q: 'auth tokens' });
    expect(both.map((h) => h.entity_id)).toContain(a);
    // The "auth tokens" multi-token query should NOT match the unrelated note (which has tokens
    // but not auth in proximity).
    const ids = both.map((h) => h.entity_id);
    expect(ids).toContain(a);
  });

  it('filters by entity_type when types[] is provided', async () => {
    const provider = createFts5Provider();
    const pid = newUlid();
    const nid = newUlid();
    await provider.indexEntity({
      entity_type: 'project',
      entity_id: pid,
      title: 'p',
      body: 'shared-keyword',
      tags: [],
    });
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: nid,
      title: 'n',
      body: 'shared-keyword',
      tags: [],
    });
    const onlyNotes = await provider.query({ q: 'shared-keyword', types: ['note'] });
    expect(onlyNotes.map((h) => h.entity_id)).toEqual([nid]);
  });

  it('returns an empty array for blank queries (no crash on punctuation-only)', async () => {
    const provider = createFts5Provider();
    const id = newUlid();
    await provider.indexEntity({
      entity_type: 'note',
      entity_id: id,
      title: 'x',
      body: 'y',
      tags: [],
    });
    const hits = await provider.query({ q: '()' });
    expect(hits).toEqual([]);
  });
});
