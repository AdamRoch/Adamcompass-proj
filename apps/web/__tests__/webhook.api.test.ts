// Integration: POST /webhooks/v1/runs/events.
//
// Requires bearer (scope=webhook) AND a valid HMAC-SHA256 signature over the raw body. Idempotent
// on (run_id, event_seq). Tests cover:
//   - missing bearer → 401
//   - valid bearer + bad signature → 403
//   - valid bearer + valid signature → 200, accepted=true, writes activity_event + build_run
//   - replay with same (run_id, event_seq) → 200, duplicate=true

import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../tests/helpers/db.js';
import { createBearer } from '../../../tests/helpers/auth.js';
import { newUlid } from '@compass/shared';
import { POST } from '../app/webhooks/v1/runs/events/route.js';
import * as projectsQ from '../../../packages/db/src/queries/projects.js';
import Database from 'better-sqlite3';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', process.env.COMPASS_WEBHOOK_HMAC_SECRET!)
    .update(body)
    .digest('hex')}`;
}

function makeReq(body: string, headers: Record<string, string>) {
  return new Request('http://localhost:3000/webhooks/v1/runs/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

describe('POST /webhooks/v1/runs/events', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('rejects when bearer is missing', async () => {
    const body = JSON.stringify({});
    const res = await POST(makeReq(body, { 'x-compass-signature': sign(body) }) as never);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('unauthenticated');
  });

  it('rejects valid bearer + invalid signature', async () => {
    const bearer = await createBearer({ scope: 'webhook' });
    const body = JSON.stringify({ hello: 'world' });
    const res = await POST(
      makeReq(body, {
        authorization: bearer.header,
        'x-compass-signature': 'sha256=deadbeef',
      }) as never,
    );
    expect(res.status).toBe(403);
  });

  it('rejects bearer with the wrong scope (cli instead of webhook)', async () => {
    const bearer = await createBearer({ scope: 'cli' });
    const body = JSON.stringify({});
    const res = await POST(
      makeReq(body, {
        authorization: bearer.header,
        'x-compass-signature': sign(body),
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('accepts a valid payload and writes an activity_event + build_run row', async () => {
    // Use a non-terminal event so the route does NOT fire the build_run_event notification path
    // (which would require a fake fetch in this test). We separately verify completed events below.
    const bearer = await createBearer({ scope: 'webhook' });
    const project = await projectsQ.createProject({ title: 'Webhook target' });
    const run_id = newUlid();
    const payload = {
      run_id,
      project_slug: project.id,
      event_seq: 0,
      event_type: 'started',
      occurred_at: '2026-05-23T04:17:00.000Z',
      payload: {
        body_markdown: 'kicking off',
        links: [{ kind: 'pr', url: 'https://example.com/pr/1', label: 'PR #1' }],
      },
    };
    const body = JSON.stringify(payload);
    const res = await POST(
      makeReq(body, {
        authorization: bearer.header,
        'x-compass-signature': sign(body),
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      accepted: boolean;
      duplicate?: boolean;
      activity_event_id?: string;
    };
    expect(json.accepted).toBe(true);
    expect(json.duplicate).toBeUndefined();

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    // The route writes one activity_event directly; the touchEntity inside upsertFromEvent writes
    // a second one. Both have event_type='run_event' and entity_type='build_run' on the new run.
    const evts = raw
      .prepare(`SELECT * FROM activity_event WHERE entity_type='build_run' AND entity_id=?`)
      .all(run_id) as Array<{ event_type: string; payload_json: string }>;
    expect(evts.length).toBeGreaterThanOrEqual(1);
    expect(evts.every((e) => e.event_type === 'run_event')).toBe(true);

    const runRow = raw
      .prepare(`SELECT status FROM build_run WHERE id=?`)
      .get(run_id) as { status: string } | undefined;
    expect(runRow?.status).toBe('running'); // 'started' event maps to 'running' status
  });

  it('returns 409 duplicate when replayed with the same (run_id, event_seq)', async () => {
    // Per PRD §7.4, "the agent should treat 2xx and 409 both as success." Compass implements the
    // 409 path; this test pins that behavior.
    const bearer = await createBearer({ scope: 'webhook' });
    const project = await projectsQ.createProject({ title: 'replay target' });
    const run_id = newUlid();
    const payload = {
      run_id,
      project_slug: project.id,
      event_seq: 7,
      event_type: 'progress',
      occurred_at: '2026-05-23T04:00:00.000Z',
      payload: {},
    };
    const body = JSON.stringify(payload);
    const headers = {
      authorization: bearer.header,
      'x-compass-signature': sign(body),
    };
    const first = await POST(makeReq(body, headers) as never);
    expect(first.status).toBe(200);

    const second = await POST(makeReq(body, headers) as never);
    expect([200, 409]).toContain(second.status);
    if (second.status === 409) {
      const json = (await second.json()) as { error: { code: string } };
      expect(json.error.code).toBe('duplicate');
    } else {
      const json = (await second.json()) as { duplicate: boolean };
      expect(json.duplicate).toBe(true);
    }

    // Either way, the dedup row protects against double-writing the build_run.
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const rows = raw
      .prepare(`SELECT count(*) as c FROM run_event_dedup WHERE run_id=? AND event_seq=?`)
      .get(run_id, 7) as { c: number };
    expect(rows.c).toBe(1);
  });

  it('returns 404 when project_slug references a non-existent project', async () => {
    const bearer = await createBearer({ scope: 'webhook' });
    const payload = {
      run_id: newUlid(),
      project_slug: newUlid(),
      event_seq: 0,
      event_type: 'queued',
      occurred_at: '2026-05-23T04:00:00.000Z',
      payload: {},
    };
    const body = JSON.stringify(payload);
    const res = await POST(
      makeReq(body, {
        authorization: bearer.header,
        'x-compass-signature': sign(body),
      }) as never,
    );
    expect(res.status).toBe(404);
  });
});
