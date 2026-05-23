import type { NotificationKind } from '@compass/shared';
import * as notif from '@compass/db/queries';
import { isInQuietHours } from '@compass/shared';
import { settings as settingsQ } from '@compass/db/queries';
import { TelegramDirectProvider } from './telegram.js';

export interface NotificationProvider {
  send(args: {
    kind: NotificationKind;
    subject: string;
    body_markdown: string;
    ref?: { entity_type: string; entity_id: string };
  }): Promise<{ id: string; status: 'sent' | 'failed' | 'suppressed'; error?: string }>;
}

let cached: NotificationProvider | null = null;

export function getNotifier(): NotificationProvider {
  if (cached) return cached;
  cached = new TelegramDirectProvider({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  });
  return cached;
}

/**
 * High-level wrapper that:
 *  - checks user settings (per-trigger enabled, telegram enabled)
 *  - respects quiet hours (queues as `pending` if in quiet hours)
 *  - records to `notifications` table either way
 */
export async function notify(args: {
  kind: NotificationKind;
  subject: string;
  body_markdown: string;
  ref?: { entity_type: string; entity_id: string };
  bypassQuietHours?: boolean;
}) {
  const settings = await settingsQ.getSettings();
  // Per-trigger enable
  if (args.kind === 'daily_digest' && !settings.notif_digest_enabled) return suppressed(args);
  if (args.kind === 'stall_alert' && !settings.notif_stall_enabled) return suppressed(args);
  if (args.kind === 'build_run_event' && !settings.notif_build_run_enabled) return suppressed(args);
  if (!settings.notif_telegram_enabled) return suppressed(args);

  // Quiet hours
  if (
    !args.bypassQuietHours &&
    isInQuietHours(settings.quiet_hours_start, settings.quiet_hours_end, settings.timezone)
  ) {
    await notif.notifications.record({
      kind: args.kind,
      entity_type: args.ref?.entity_type ?? null,
      entity_id: args.ref?.entity_id ?? null,
      payload: { subject: args.subject, body_markdown: args.body_markdown },
      status: 'pending',
    });
    return { status: 'pending' as const };
  }

  // Send
  const provider = getNotifier();
  const res = await provider.send(args);
  await notif.notifications.record({
    kind: args.kind,
    entity_type: args.ref?.entity_type ?? null,
    entity_id: args.ref?.entity_id ?? null,
    payload: { subject: args.subject, body_markdown: args.body_markdown },
    status: res.status,
    error: res.error,
  });
  return res;
}

/**
 * Drain pending notifications (called by scheduler when quiet hours end).
 */
export async function drainPending() {
  const pending = await notif.notifications.listPending();
  const provider = getNotifier();
  for (const row of pending) {
    try {
      const payload = JSON.parse(row.payload_json) as { subject: string; body_markdown: string };
      const res = await provider.send({
        kind: row.kind,
        subject: payload.subject,
        body_markdown: payload.body_markdown,
        ref:
          row.entity_type && row.entity_id
            ? { entity_type: row.entity_type, entity_id: row.entity_id }
            : undefined,
      });
      if (res.status === 'sent') {
        await notif.notifications.markSent(row.id);
      } else {
        await notif.notifications.markFailed(row.id, res.error ?? 'send failed');
      }
    } catch (e) {
      await notif.notifications.markFailed(row.id, String(e));
    }
  }
}

async function suppressed(args: {
  kind: NotificationKind;
  subject: string;
  body_markdown: string;
  ref?: { entity_type: string; entity_id: string };
}) {
  await notif.notifications.record({
    kind: args.kind,
    entity_type: args.ref?.entity_type ?? null,
    entity_id: args.ref?.entity_id ?? null,
    payload: { subject: args.subject, body_markdown: args.body_markdown },
    status: 'suppressed',
  });
  return { status: 'suppressed' as const };
}

export { TelegramDirectProvider };
export { escapeMarkdownV2, escapeMarkdownV2Url } from './telegram.js';
