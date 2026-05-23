// E2E 3: Webhook POST → activity event → dashboard.
//
// PRD §1.3 demoable flow #3.
//
// The route handler is fully implemented (apps/web/app/webhooks/v1/runs/events/route.ts) and
// exhaustively unit-tested at apps/web/__tests__/webhook.api.test.ts (six tests covering bearer
// rejection, signature rejection, wrong scope, happy path, replay dedupe, missing project).
//
// This E2E spec covers the same flow over HTTP into a running server, using the admin tokens
// endpoint (`POST /api/v1/admin/tokens`) to mint a webhook-scope bearer.

import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const HMAC_SECRET =
  process.env.COMPASS_WEBHOOK_HMAC_SECRET ?? 'e2e-hmac-secret-32chars-dddddddd';

function sign(rawBody: string): string {
  return `sha256=${createHmac('sha256', HMAC_SECRET).update(rawBody).digest('hex')}`;
}

function ulid(): string {
  // Crockford base32, 26 chars — same alphabet/shape as the real generator.
  const alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let i = 0; i < 26; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

test.describe('webhook → activity event → dashboard', () => {
  test('accepts first delivery, dedupes the replay, and surfaces the run on the project', async ({
    page,
    request,
  }) => {
    // Bootstrap login → session cookie.
    await page.goto('/login');
    const email = `e2e-webhook-${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'correct-horse-battery-staple');
    await Promise.all([
      page.waitForURL('**/'),
      page.click('button[type="submit"]'),
    ]);
    const cookies = await page.context().cookies('http://localhost:3000');
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Create a project (cookie-authenticated, no bearer required).
    const projectRes = await request.post('/api/v1/projects', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { title: 'webhook-target' },
    });
    expect(projectRes.ok()).toBeTruthy();
    const { project } = (await projectRes.json()) as { project: { id: string; title: string } };

    // Mint a webhook-scope bearer via the admin endpoint (user session required, which we have).
    const mintRes = await request.post('/api/v1/admin/tokens', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { name: 'e2e-webhook', scope: 'webhook' },
    });
    expect(mintRes.status()).toBe(201);
    const minted = (await mintRes.json()) as { token: { plain_once: string } };
    const webhookBearer = minted.token.plain_once;
    expect(webhookBearer).toMatch(/^cpsw_/);

    const run_id = ulid();
    const payload = {
      run_id,
      project_slug: project.id,
      event_seq: 0,
      event_type: 'started',
      occurred_at: new Date().toISOString(),
      payload: { body_markdown: 'kick off' },
    };
    const body = JSON.stringify(payload);
    const headers = {
      authorization: `Bearer ${webhookBearer}`,
      'content-type': 'application/json',
      'x-compass-signature': sign(body),
    };
    const first = await request.post('/webhooks/v1/runs/events', { headers, data: body });
    expect(first.status()).toBe(200);
    const firstJson = (await first.json()) as { accepted: boolean };
    expect(firstJson.accepted).toBe(true);

    const second = await request.post('/webhooks/v1/runs/events', { headers, data: body });
    expect([200, 409]).toContain(second.status());
    const secondJson = (await second.json()) as
      | { accepted: boolean; duplicate?: boolean }
      | { error: { code: string } };
    if ('accepted' in secondJson) {
      expect(secondJson.duplicate).toBe(true);
    } else {
      expect(secondJson.error.code).toBe('duplicate');
    }

    const projDetailRes = await request.get(`/api/v1/projects/${project.id}`, {
      headers: { cookie: cookieHeader },
    });
    expect(projDetailRes.ok()).toBeTruthy();
    const detail = (await projDetailRes.json()) as {
      project: { id: string };
      build_runs: Array<{ id: string; status: string }>;
    };
    expect(detail.build_runs.some((r) => r.id === run_id)).toBe(true);
  });
});
