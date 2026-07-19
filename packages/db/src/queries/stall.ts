import { addDaysIso, nowIso } from '@compass/shared';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../index.js';

export interface StallAlertState {
  entity_type: string;
  entity_id: string;
  last_alerted_at: string;
  alert_count: number;
  suppressed_until: string | null;
}

export async function getStallState(
  entityType: string,
  entityId: string,
): Promise<StallAlertState | null> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.stall_alerts)
    .where(
      and(
        eq(handle.schema.stall_alerts.entity_type, entityType),
        eq(handle.schema.stall_alerts.entity_id, entityId),
      ),
    )
    .limit(1);
  return (rows[0] as StallAlertState | undefined) ?? null;
}

/**
 * Decide whether to fire a new stall alert per the dedupe rules in PRD §10.4.
 * Returns:
 *  - 'fire': caller should send notification and call markAlerted()
 *  - 'skip': suppressed by cooldown
 *  - 'reminder': 7-day "still stalled" reminder slot is up
 */
export async function shouldFireStall(
  entityType: string,
  entityId: string,
  lastTouchedAt: string,
  now = nowIso(),
): Promise<'fire' | 'skip' | 'reminder'> {
  const prev = await getStallState(entityType, entityId);
  if (!prev) return 'fire';
  if (prev.suppressed_until && prev.suppressed_until > now) return 'skip';

  // Did the entity get touched after the last alert and re-cross threshold?
  if (lastTouchedAt > prev.last_alerted_at) return 'fire';

  // 7-day reminder window
  const aWeekAgo = addDaysIso(now, -7);
  if (prev.last_alerted_at < aWeekAgo) return 'reminder';

  return 'skip';
}

export async function markAlerted(
  entityType: string,
  entityId: string,
  now = nowIso(),
  suppressForDays = 7,
) {
  const handle = getDb();
  const prev = await getStallState(entityType, entityId);
  const suppressedUntil = addDaysIso(now, suppressForDays);
  if (!prev) {
    await handle.db.insert(handle.schema.stall_alerts).values({
      entity_type: entityType,
      entity_id: entityId,
      last_alerted_at: now,
      alert_count: 1,
      suppressed_until: suppressedUntil,
    });
  } else {
    await handle.db
      .update(handle.schema.stall_alerts)
      .set({
        last_alerted_at: now,
        alert_count: prev.alert_count + 1,
        suppressed_until: suppressedUntil,
      })
      .where(
        and(
          eq(handle.schema.stall_alerts.entity_type, entityType),
          eq(handle.schema.stall_alerts.entity_id, entityId),
        ),
      );
  }
}

export async function clearStallState(entityType: string, entityId: string) {
  const handle = getDb();
  await handle.db
    .delete(handle.schema.stall_alerts)
    .where(
      and(
        eq(handle.schema.stall_alerts.entity_type, entityType),
        eq(handle.schema.stall_alerts.entity_id, entityId),
      ),
    );
}
