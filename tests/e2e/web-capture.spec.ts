// E2E 1: Web capture → file → dashboard.
//
// PRD §1.3 demoable flow #1.
//
// Notes / caveats:
// - The bootstrap signup happens on first POST to the login form (apps/web/app/(auth)/login/page.tsx)
//   — no users? → create one + sign in + redirect to `/`.
// - The dashboard `(app)/page.tsx` is currently a placeholder; we assert on the topbar's capture
//   input being present and that the round-trip POST → /api/v1/inbox shows the note.
// - The web app does not yet expose `/inbox` or `/projects/:id` as pages, so the "click through"
//   parts of the flow are exercised via API calls instead of clicks. We document each substitution.

import { test, expect } from '@playwright/test';

test.describe('web capture → file → dashboard', () => {
  test('signup, capture from dashboard, file via API, verify note attached', async ({
    page,
    request,
  }) => {
    // 1. Visit /login, sign up via the form-bootstrap path. A 2xx response means the redirect to /
    // landed on the dashboard.
    await page.goto('/login');
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'correct-horse-battery-staple';
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
      page.waitForURL('**/'),
      page.click('button[type="submit"]'),
    ]);
    expect(page.url()).toMatch(/\/(?:$|\?)/);

    // 2. Type into the global capture input on the dashboard, submit. The TopCaptureBar lives in
    // the (app) layout, so it's present on every authenticated page.
    const input = page.locator('input[aria-label="Quick capture input"]');
    await expect(input).toBeVisible();
    const captureText = `e2e capture ${Date.now()}`;
    await input.fill(captureText);
    await input.press('Enter');

    // 3. Confirm via API that the note landed in the inbox. Cookie is on the page context and we
    // can borrow it for the request context if we read it back, but the inbox API also accepts a
    // bearer — easier: pull cookies and forward.
    const cookies = await page.context().cookies('http://localhost:3000');
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Poll briefly — the capture POST is fire-and-forget from the UI.
    let foundNote: { id: string; body_markdown: string } | undefined;
    for (let i = 0; i < 10 && !foundNote; i++) {
      const res = await request.get('/api/v1/inbox', {
        headers: { cookie: cookieHeader },
      });
      expect(res.ok()).toBeTruthy();
      const json = (await res.json()) as { notes: Array<{ id: string; body_markdown: string }> };
      foundNote = json.notes.find((n) => n.body_markdown === captureText);
      if (!foundNote) await page.waitForTimeout(200);
    }
    expect(foundNote, `capture "${captureText}" should appear in /api/v1/inbox`).toBeDefined();

    // 4. "File" into a new project via API (the inbox UI page doesn't yet exist; the file-from-
    // inbox API is the canonical mutation the UI will call).
    const fileRes = await request.post(`/api/v1/inbox/${foundNote!.id}/file`, {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { target: 'new_project', title: 'E2E created project' },
    });
    expect(fileRes.ok()).toBeTruthy();
    const fileJson = (await fileRes.json()) as {
      note: { entity_type: string; entity_id: string };
      target: { type: string; id: string };
    };
    expect(fileJson.note.entity_type).toBe('project');
    expect(fileJson.target.type).toBe('project');

    // 5. Verify the project exists + dashboard "momentum" surfaces it.
    const projRes = await request.get(`/api/v1/projects/${fileJson.target.id}`, {
      headers: { cookie: cookieHeader },
    });
    expect(projRes.ok()).toBeTruthy();
    const projJson = (await projRes.json()) as { project: { title: string }; notes: Array<{ id: string }> };
    expect(projJson.project.title).toBe('E2E created project');
    expect(projJson.notes.some((n) => n.id === foundNote!.id)).toBe(true);

    const momentumRes = await request.get('/api/v1/dashboard/momentum', {
      headers: { cookie: cookieHeader },
    });
    expect(momentumRes.ok()).toBeTruthy();
    const momentumJson = (await momentumRes.json()) as { items: Array<{ id: string }> };
    expect(momentumJson.items.some((m) => m.id === fileJson.target.id)).toBe(true);
  });
});
