import type { Page } from '@playwright/test';

// One shared account for the whole e2e run: the first spec to hit /login bootstraps it
// (COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=1 in playwright.config webServer env), later specs
// sign in with the same credentials — Compass is a single-user app.
//
// IMPORTANT: specs share ONE server DB for the whole run (reset only at webServer boot).
// Keep every cross-spec assertion EXISTENCE-based (`.some/.find/.toContain` on unique
// per-spec strings) — never assert exact counts or empty states, or the suite becomes
// order-dependent and flakes on CI retries.
export const E2E_EMAIL = 'e2e@compass.local';
export const E2E_PASSWORD = 'correct-horse-battery-staple';

export async function signIn(page: Page): Promise<string> {
  await page.goto('/login');
  await page.fill('input[name="email"]', E2E_EMAIL);
  await page.fill('input[name="password"]', E2E_PASSWORD);
  await Promise.all([page.waitForURL('**/'), page.click('button[type="submit"]')]);
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}
