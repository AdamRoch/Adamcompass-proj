// Integration: POST /api/v1/captures.
//
// We call the route handler directly with a constructed Request and assert on the NextResponse it
// returns. The handler reads the bearer header via requireAuth() → authenticateBearer() →
// authQ.findActiveTokenByHash, so a real auth_token row is created up-front via the helper.

import { beforeEach, describe, expect, it } from 'vitest';
import { createBearer } from '../../../tests/helpers/auth.js';
import { setupTestDb } from '../../../tests/helpers/db.js';
import { POST } from '../app/api/v1/captures/route.js';

function makeReq(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/v1/captures', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/captures', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('rejects requests without an Authorization header', async () => {
    const req = makeReq({
      idem_key: 'idem-noauth-001',
      client_id: 'cli',
      body: 'hi',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('unauthenticated');
  });

  it('rejects requests with an invalid bearer token', async () => {
    const req = makeReq(
      { idem_key: 'idem-badauth-1', client_id: 'cli', body: 'hi' },
      { authorization: 'Bearer not-a-real-token' },
    );
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('accepts a valid bearer and creates a note', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const req = makeReq(
      {
        idem_key: 'idem-ok-001',
        client_id: 'cli-test',
        body: 'first capture',
        tags: ['x'],
      },
      { authorization: bearer.header },
    );
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      note: { id: string; body_markdown: string; entity_id: string | null };
      duplicate: boolean;
    };
    expect(json.duplicate).toBe(false);
    expect(json.note.body_markdown).toBe('first capture');
    expect(json.note.entity_id).toBeNull();
  });

  it('returns 200 with duplicate=true on the same (client_id, idem_key)', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const body = {
      idem_key: 'idem-dup-api',
      client_id: 'cli-test',
      body: 'first time',
      tags: [],
    };
    const r1 = await POST(makeReq(body, { authorization: bearer.header }) as never);
    expect(r1.status).toBe(201);

    const r2 = await POST(
      makeReq({ ...body, body: 'should be ignored' }, { authorization: bearer.header }) as never,
    );
    expect(r2.status).toBe(200);
    const json = (await r2.json()) as { duplicate: boolean; note: { id: string } };
    expect(json.duplicate).toBe(true);
  });

  it('returns 422 on a missing body field', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const req = makeReq(
      { idem_key: 'idem-bad-022', client_id: 'cli' /* body missing */ },
      { authorization: bearer.header },
    );
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });
});
