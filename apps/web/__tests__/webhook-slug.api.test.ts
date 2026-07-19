// V2: the webhook `project_slug` field accepts the project's human slug in addition to its ULID.
// Also covers slug auto-derivation on createProject and run attribution to the resolved id.

import { createHmac } from 'node:crypto';
import { newUlid } from '@compass/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import * as buildRunsQ from '../../../packages/db/src/queries/build_runs.js';
import * as projectsQ from '../../../packages/db/src/queries/projects.js';
import { createBearer } from '../../../tests/helpers/auth.js';
import { setupTestDb } from '../../../tests/helpers/db.js';
import { POST } from '../app/webhooks/v1/runs/events/route.js';

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

describe('webhook project_slug resolution (V2)', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('derives a kebab slug on create and dedupes collisions', async () => {
    const a = await projectsQ.createProject({ title: 'My Cool App!' });
    const b = await projectsQ.createProject({ title: 'My Cool App?' });
    expect(a.slug).toBe('my-cool-app');
    expect(b.slug).toBe('my-cool-app-2');
    expect((await projectsQ.getProjectBySlug('my-cool-app'))!.id).toBe(a.id);
  });

  it('accepts an event addressed by slug and attributes the run to the project id', async () => {
    const project = await projectsQ.createProject({ title: 'Slug Target' });
    const bearer = await createBearer({ scope: 'webhook' });
    const body = JSON.stringify({
      run_id: newUlid(),
      project_slug: project.slug,
      event_seq: 0,
      event_type: 'completed',
      occurred_at: new Date().toISOString(),
      payload: { result: 'succeeded', body_markdown: 'done', duration_ms: 1000 },
    });
    const res = await POST(
      makeReq(body, { authorization: bearer.header, 'x-compass-signature': sign(body) }) as never,
    );
    expect(res.status).toBe(200);

    const runs = await buildRunsQ.listForProject(project.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('completed');
  });

  it('404s an unknown slug', async () => {
    const bearer = await createBearer({ scope: 'webhook' });
    const body = JSON.stringify({
      run_id: newUlid(),
      project_slug: 'no-such-project',
      event_seq: 0,
      event_type: 'queued',
      occurred_at: new Date().toISOString(),
      payload: {},
    });
    const res = await POST(
      makeReq(body, { authorization: bearer.header, 'x-compass-signature': sign(body) }) as never,
    );
    expect(res.status).toBe(404);
  });
});
