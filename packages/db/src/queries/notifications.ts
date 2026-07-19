import { type NotificationKind, type NotificationStatus, newUlid, nowIso } from '@compass/shared';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '../index.js';

const MAX_NOTIFICATION_RETRIES = 5;

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  entity_type: string | null;
  entity_id: string | null;
  channel: 'telegram';
  payload_json: string;
  status: NotificationStatus;
  error_message: string | null;
  retry_count: number;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export async function record(input: {
  kind: NotificationKind;
  entity_type?: string | null;
  entity_id?: string | null;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  error?: string;
  sent_at?: string | null;
}): Promise<NotificationRow> {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  const row = {
    id,
    kind: input.kind,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    channel: 'telegram' as const,
    payload_json: JSON.stringify(input.payload),
    status: input.status,
    error_message: input.error ?? null,
    retry_count: 0,
    next_attempt_at: null,
    created_at: now,
    sent_at: input.sent_at ?? (input.status === 'sent' ? now : null),
  };
  await handle.db.insert(handle.schema.notifications).values(row);
  return row;
}

export async function listRecent(limit = 200): Promise<NotificationRow[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.notifications)
    .orderBy(desc(handle.schema.notifications.created_at))
    .limit(limit);
  return rows as NotificationRow[];
}

export async function listPending(): Promise<NotificationRow[]> {
  const handle = getDb();
  const now = nowIso();
  // Pull anything pending whose next_attempt_at is either NULL (never attempted) or due.
  const rows = await handle.db
    .select()
    .from(handle.schema.notifications)
    .where(
      and(
        eq(handle.schema.notifications.status, 'pending'),
        or(
          isNull(handle.schema.notifications.next_attempt_at),
          lt(handle.schema.notifications.next_attempt_at, now),
        )!,
      ),
    )
    .orderBy(handle.schema.notifications.created_at);
  return rows as NotificationRow[];
}

export async function markSent(id: string, sent_at = nowIso()) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.notifications)
    .set({ status: 'sent', sent_at })
    .where(eq(handle.schema.notifications.id, id));
}

/**
 * Mark a notification as failed-this-attempt. If the attempt count is below
 * MAX_NOTIFICATION_RETRIES, flip status back to `pending` with a `next_attempt_at` set per
 * exponential backoff so the drain picks it up later. Once the count reaches the cap, leave
 * the row terminally `failed`.
 */
export async function markFailed(id: string, error: string) {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.notifications)
    .where(eq(handle.schema.notifications.id, id))
    .limit(1);
  const row = rows[0] as NotificationRow | undefined;
  if (!row) return;
  const nextCount = (row.retry_count ?? 0) + 1;
  if (nextCount >= MAX_NOTIFICATION_RETRIES) {
    await handle.db
      .update(handle.schema.notifications)
      .set({
        status: 'failed',
        error_message: error,
        retry_count: nextCount,
        next_attempt_at: null,
      })
      .where(eq(handle.schema.notifications.id, id));
    return;
  }
  // Backoff: 1, 2, 4, 8, 16 minutes — capped by MAX_NOTIFICATION_RETRIES.
  const backoffMinutes = 2 ** (nextCount - 1);
  const next = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
  await handle.db
    .update(handle.schema.notifications)
    .set({
      status: 'pending',
      error_message: error,
      retry_count: nextCount,
      next_attempt_at: next,
    })
    .where(eq(handle.schema.notifications.id, id));
}

export async function purgeOlderThan(iso: string) {
  const handle = getDb();
  await handle.db
    .delete(handle.schema.notifications)
    .where(lt(handle.schema.notifications.created_at, iso));
}
