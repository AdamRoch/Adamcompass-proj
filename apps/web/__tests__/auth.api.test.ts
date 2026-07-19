// Bearer authentication: every /api/v1 route requires either a session cookie or a bearer token.
// We test the contract via two representative routes:
//   - GET /api/v1/inbox (read endpoint)
//   - POST /api/v1/projects (write endpoint)
//
// Both share the same requireAuth() helper, so passing through them exercises the auth surface.

import { beforeEach, describe, expect, it } from 'vitest';
import { createBearer } from '../../../tests/helpers/auth.js';
import { setupTestDb } from '../../../tests/helpers/db.js';
import { GET as inboxGet } from '../app/api/v1/inbox/route.js';
import { POST as projectsPost } from '../app/api/v1/projects/route.js';

describe('bearer authentication', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('GET /api/v1/inbox rejects missing bearer with 401', async () => {
    const req = new Request('http://localhost:3000/api/v1/inbox');
    const res = await inboxGet(req as never);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('unauthenticated');
  });

  it('GET /api/v1/inbox rejects invalid bearer with 401', async () => {
    const req = new Request('http://localhost:3000/api/v1/inbox', {
      headers: { authorization: 'Bearer total-garbage' },
    });
    const res = await inboxGet(req as never);
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/inbox accepts a valid bearer and returns notes array', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const req = new Request('http://localhost:3000/api/v1/inbox', {
      headers: { authorization: bearer.header },
    });
    const res = await inboxGet(req as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { notes: unknown[] };
    expect(Array.isArray(json.notes)).toBe(true);
    expect(json.notes.length).toBe(0); // empty DB
  });

  it('POST /api/v1/projects requires auth', async () => {
    const req = new Request('http://localhost:3000/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'should fail' }),
    });
    const res = await projectsPost(req as never);
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/projects accepts a valid bearer and creates the project', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const req = new Request('http://localhost:3000/api/v1/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: bearer.header,
      },
      body: JSON.stringify({ title: 'authed creation', summary: 'works' }),
    });
    const res = await projectsPost(req as never);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { project: { title: string; id: string } };
    expect(json.project.title).toBe('authed creation');
    expect(json.project.id).toHaveLength(26);
  });
});
