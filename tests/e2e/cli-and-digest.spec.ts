// E2E 2: CLI capture → daily Telegram digest.
//
// PRD §1.3 demoable flow #2.
//
// Caveats / scope:
// - We do NOT invoke the `compass` CLI binary directly — that depends on `bun build --compile`
//   and an outbox file on disk. Instead we drive the same API the binary calls
//   (POST /api/v1/captures) via the cookie session created by the login bootstrap. This proves
//   the API contract; the CLI's role is just to set Authorization to a bearer that targets the
//   same handler.
// - We do NOT hit the real Telegram Bot API; the test asserts on the body returned by
//   GET /api/v1/dashboard/digest/daily — that's the markdown the scheduler hands to notify().
//   Per PRD §11.5, this endpoint is also the seam OpenClaw can pull.
// - To avoid needing a bearer at all (which would require DB access from the test runner — not
//   available from the Playwright process since better-sqlite3 isn't a root dep), we authenticate
//   the request context with the same session cookie produced by the bootstrap login.

import { expect, test } from '@playwright/test';
import { signIn } from './login';

test.describe('CLI-style capture + daily digest', () => {
  test('signup, POST capture, then assert digest body has expected sections', async ({
    page,
    request,
  }) => {
    // Sign in (bootstraps the shared e2e account on first run) → session cookie.
    const cookieHeader = await signIn(page);

    // 1. Create a project with target_date=today so the digest "This week" surfaces it.
    const projectRes = await request.post('/api/v1/projects', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: {
        title: 'E2E digest project',
        summary: "should appear in today's digest",
        target_date: new Date().toISOString().slice(0, 10),
      },
    });
    expect(projectRes.ok()).toBeTruthy();

    // 2. POST a capture (the CLI-equivalent call).
    const captureRes = await request.post('/api/v1/captures', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: {
        idem_key: `e2e-cli-idem-${Date.now()}`,
        client_id: 'e2e-cli',
        body: 'ship the auth changes',
      },
    });
    expect([200, 201]).toContain(captureRes.status());

    // 3. Render the digest. Assert the three canonical sections appear and the project surfaces.
    const digestRes = await request.get('/api/v1/dashboard/digest/daily', {
      headers: { cookie: cookieHeader },
    });
    expect(digestRes.ok()).toBeTruthy();
    const { markdown } = (await digestRes.json()) as { markdown: string };

    expect(markdown).toContain('Momentum');
    expect(markdown).toContain('Needs attention');
    expect(markdown).toContain('This week');
    expect(markdown).toContain('E2E digest project');
    // Footer enumerates inbox count.
    expect(markdown).toMatch(/\d+\s*in inbox/);
  });
});
