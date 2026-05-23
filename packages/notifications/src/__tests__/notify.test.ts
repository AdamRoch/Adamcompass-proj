// Verifies the notify() wrapper:
//   - per-trigger settings toggles → records as 'suppressed' and does not send
//   - quiet-hours window → queues as 'pending' (returns { status: 'pending' })
//   - master telegram toggle off → 'suppressed'
//   - drainPending sends queued items
//
// We avoid hitting real Telegram by replacing the global `fetch` (which TelegramDirectProvider
// calls) with a recorder that returns 200 OK. We also set bot token/chat id env vars so the
// provider doesn't short-circuit to "failed" before calling fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as settingsQ from '../../../db/src/queries/settings.js';
import * as notifQ from '../../../db/src/queries/notifications.js';
import type { drainPending as DrainPendingT, notify as NotifyT } from '../index.js';

function installFakeFetch() {
  process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
  process.env.TELEGRAM_CHAT_ID = 'fake-chat-id';
  const sent: Array<{ url: string; body: string }> = [];
  const fakeFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : '';
    sent.push({ url: String(url), body });
    return new Response('{"ok":true}', { status: 200 });
  });
  vi.stubGlobal('fetch', fakeFetch);
  return { sent, fakeFetch };
}

// Each test imports fresh module copies so the in-module `cached` notifier doesn't bleed env vars
// across tests.
async function freshModule(): Promise<{ notify: typeof NotifyT; drainPending: typeof DrainPendingT }> {
  vi.resetModules();
  return await import('../index.js');
}

describe('notify()', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('records as suppressed when the per-trigger toggle is off', async () => {
    await settingsQ.patchSettings({ notif_stall_enabled: false });
    const { sent } = installFakeFetch();
    const { notify } = await freshModule();
    const res = await notify({
      kind: 'stall_alert',
      subject: 'Stalled: x',
      body_markdown: 'body',
    });
    expect(res.status).toBe('suppressed');
    expect(sent).toEqual([]);
    const rows = await notifQ.listRecent();
    expect(rows[0]!.status).toBe('suppressed');
  });

  it('records as suppressed when the master telegram toggle is off', async () => {
    await settingsQ.patchSettings({ notif_telegram_enabled: false });
    const { sent } = installFakeFetch();
    const { notify } = await freshModule();
    const res = await notify({
      kind: 'daily_digest',
      subject: 'Digest',
      body_markdown: 'm',
    });
    expect(res.status).toBe('suppressed');
    expect(sent).toEqual([]);
  });

  it('queues as pending during quiet hours', async () => {
    await settingsQ.patchSettings({
      timezone: 'UTC',
      quiet_hours_start: '00:00',
      quiet_hours_end: '23:59',
    });
    const { sent } = installFakeFetch();
    const { notify } = await freshModule();
    const res = await notify({
      kind: 'stall_alert',
      subject: 'Stalled',
      body_markdown: 'b',
    });
    expect(res.status).toBe('pending');
    expect(sent).toEqual([]);
    const rows = await notifQ.listRecent();
    expect(rows[0]!.status).toBe('pending');
  });

  it('actually sends when settings allow + outside quiet hours', async () => {
    // start === end disables the quiet-hours window entirely.
    await settingsQ.patchSettings({
      quiet_hours_start: '09:00',
      quiet_hours_end: '09:00',
    });
    const { sent } = installFakeFetch();
    const { notify } = await freshModule();
    const res = await notify({
      kind: 'build_run_event',
      subject: 'Run completed',
      body_markdown: 'PR merged',
    });
    expect(res.status).toBe('sent');
    expect(sent.length).toBe(1);
    expect(sent[0]!.url).toContain('https://api.telegram.org/bot');
    const payload = JSON.parse(sent[0]!.body) as { text: string };
    expect(payload.text).toContain('Run completed');
    expect(payload.text).toContain('PR merged');
  });
});

describe('drainPending()', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends every queued notification and marks them sent', async () => {
    await settingsQ.patchSettings({
      timezone: 'UTC',
      quiet_hours_start: '00:00',
      quiet_hours_end: '23:59',
    });
    const { sent } = installFakeFetch();
    const { notify, drainPending } = await freshModule();

    await notify({ kind: 'stall_alert', subject: 'a', body_markdown: 'aa' });
    await notify({ kind: 'stall_alert', subject: 'b', body_markdown: 'bb' });

    expect(sent.length).toBe(0);
    const pendingBefore = await notifQ.listPending();
    expect(pendingBefore.length).toBe(2);

    await drainPending();

    expect(sent.length).toBe(2);
    const pendingAfter = await notifQ.listPending();
    expect(pendingAfter.length).toBe(0);
  });
});
