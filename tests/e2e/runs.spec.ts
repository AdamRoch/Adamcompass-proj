// E2E 4 (V2): queue a run → agent reports via webhook → overnight summary on the dashboard.
// PRD V2 §6 demoable flow #4, using the queued run's own id like a real agent would.

import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { signIn } from './login';

const HMAC_SECRET = process.env.COMPASS_WEBHOOK_HMAC_SECRET ?? 'e2e-hmac-secret-32chars-dddddddd';

function sign(rawBody: string): string {
  return `sha256=${createHmac('sha256', HMAC_SECRET).update(rawBody).digest('hex')}`;
}

test.describe('queue run → webhook events → overnight summary', () => {
  test('queued run completes via webhook and surfaces on project + dashboard', async ({
    page,
    request,
  }) => {
    const cookieHeader = await signIn(page);

    // Create a project and queue a run with an objective.
    const projectRes = await request.post('/api/v1/projects', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { title: `run-target-${Date.now()}` },
    });
    expect(projectRes.ok()).toBeTruthy();
    const { project } = (await projectRes.json()) as {
      project: { id: string; slug: string | null };
    };

    const objective = `overnight objective ${Date.now()}`;
    const queueRes = await request.post(`/api/v1/projects/${project.id}/runs`, {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { objective },
    });
    expect(queueRes.status()).toBe(201);
    const { run } = (await queueRes.json()) as { run: { id: string; status: string } };
    expect(run.status).toBe('queued');

    // Mint a webhook token and play the agent: started → completed, addressing by SLUG.
    const tokenRes = await request.post('/api/v1/admin/tokens', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { scope: 'webhook', name: `e2e-runs-${Date.now()}` },
    });
    expect(tokenRes.ok()).toBeTruthy();
    const tokenJson = (await tokenRes.json()) as { token: { plain_once: string } };
    const bearer = tokenJson.token.plain_once;
    expect(bearer).toBeTruthy();

    const send = async (event_seq: number, event_type: string, payload: object) => {
      const body = JSON.stringify({
        run_id: run.id,
        project_slug: project.slug ?? project.id,
        event_seq,
        event_type,
        occurred_at: new Date().toISOString(),
        payload,
      });
      return request.post('/webhooks/v1/runs/events', {
        headers: {
          authorization: `Bearer ${bearer}`,
          'x-compass-signature': sign(body),
          'content-type': 'application/json',
        },
        data: body,
      });
    };

    expect((await send(0, 'started', {})).ok()).toBeTruthy();
    const done = await send(1, 'completed', {
      result: 'succeeded',
      body_markdown: 'shipped it',
      duration_ms: 60_000,
    });
    expect(done.ok()).toBeTruthy();

    // Run status is terminal on the project's runs API.
    const runsRes = await request.get(`/api/v1/projects/${project.id}/runs`, {
      headers: { cookie: cookieHeader },
    });
    const runsJson = (await runsRes.json()) as { runs: Array<{ id: string; status: string }> };
    expect(runsJson.runs.find((r) => r.id === run.id)?.status).toBe('completed');

    // Dashboard shows the overnight summary with the objective.
    await page.goto('/');
    await expect(page.getByText('Overnight runs')).toBeVisible();
    await expect(page.getByText(objective)).toBeVisible();
  });
});
