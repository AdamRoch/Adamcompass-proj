// Coverage for the dedupe state machine in packages/db/src/queries/stall.ts, per PRD §10.4.
//
// The state machine returns one of `fire | skip | reminder` and the test cases cover the four
// branches called out in the PRD:
//   1. First time — no prev row → 'fire'
//   2. Suppressed — prev.suppressed_until > now → 'skip'
//   3. Touched after alert and re-crossed threshold → 'fire'
//   4. Older than 7 days since last alert → 'reminder'
// Plus one extra: unsnoozed without touch should NOT auto-fire (the dedupe row already exists).

import { addDaysIso, newUlid } from '@compass/shared';
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as stallQ from '../queries/stall.js';

const TYPE = 'project';

function unique(): string {
  return newUlid();
}

describe('shouldFireStall', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('returns "fire" on first encounter (no prev row)', async () => {
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    const lastTouched = addDaysIso(now, -5);
    const decision = await stallQ.shouldFireStall(TYPE, id, lastTouched, now);
    expect(decision).toBe('fire');
  });

  it('returns "skip" while inside the 7-day cooldown window', async () => {
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    const lastTouched = addDaysIso(now, -5);
    // Simulate a previous alert 2 days ago, cooldown ends in 5 days.
    await stallQ.markAlerted(TYPE, id, addDaysIso(now, -2));
    const decision = await stallQ.shouldFireStall(TYPE, id, lastTouched, now);
    expect(decision).toBe('skip');
  });

  it('returns "fire" when entity was touched after the last alert AND cooldown has expired', async () => {
    // Per PRD §10.4: suppression takes precedence; "touched after alert" only re-fires once the
    // 7-day cooldown is up.
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    // Alerted 4 days ago; suppression already past (1 day ago). User touched the entity 2 days ago
    // (after the alert).
    raw
      .prepare(
        `INSERT INTO stall_alerts (entity_type, entity_id, last_alerted_at, alert_count, suppressed_until)
         VALUES (?, ?, ?, 1, ?)`,
      )
      .run(TYPE, id, addDaysIso(now, -4), addDaysIso(now, -1));
    const lastTouched = addDaysIso(now, -2);
    const decision = await stallQ.shouldFireStall(TYPE, id, lastTouched, now);
    expect(decision).toBe('fire');
  });

  it('returns "reminder" when 7 days have passed since the last alert', async () => {
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    // Manually backdate the row: alerted 8 days ago, suppression already expired.
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    raw
      .prepare(
        `INSERT INTO stall_alerts (entity_type, entity_id, last_alerted_at, alert_count, suppressed_until)
       VALUES (?, ?, ?, 1, ?)`,
      )
      .run(TYPE, id, addDaysIso(now, -8), addDaysIso(now, -1));
    // Entity hasn't been touched since the original alert.
    const lastTouched = addDaysIso(now, -20);
    const decision = await stallQ.shouldFireStall(TYPE, id, lastTouched, now);
    expect(decision).toBe('reminder');
  });

  it('does not auto-fire just because suppression expired without touch and without 7d gap', async () => {
    // Edge: alerted 3 days ago, suppression set to expire 1 day ago (manual override),
    // and entity never touched. Per PRD: "Unsnoozing without touching does NOT auto-re-fire"
    // and "The 7-day cooldown still applies." This case is between cooldown end and 7-day reminder,
    // so the machine should still skip.
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    raw
      .prepare(
        `INSERT INTO stall_alerts (entity_type, entity_id, last_alerted_at, alert_count, suppressed_until)
       VALUES (?, ?, ?, 1, ?)`,
      )
      .run(TYPE, id, addDaysIso(now, -3), addDaysIso(now, -1));
    const lastTouched = addDaysIso(now, -10);
    const decision = await stallQ.shouldFireStall(TYPE, id, lastTouched, now);
    expect(decision).toBe('skip');
  });
});

describe('markAlerted', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('inserts a new row with alert_count=1 and a 7-day cooldown on first call', async () => {
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    await stallQ.markAlerted(TYPE, id, now);
    const state = await stallQ.getStallState(TYPE, id);
    expect(state).toBeTruthy();
    expect(state!.alert_count).toBe(1);
    expect(state!.last_alerted_at).toBe(now);
    expect(state!.suppressed_until).toBe(addDaysIso(now, 7));
  });

  it('increments alert_count and resets cooldown on subsequent calls', async () => {
    const id = unique();
    const t1 = '2026-05-15T12:00:00.000Z';
    const t2 = '2026-05-23T12:00:00.000Z';
    await stallQ.markAlerted(TYPE, id, t1);
    await stallQ.markAlerted(TYPE, id, t2);
    const state = await stallQ.getStallState(TYPE, id);
    expect(state!.alert_count).toBe(2);
    expect(state!.last_alerted_at).toBe(t2);
    expect(state!.suppressed_until).toBe(addDaysIso(t2, 7));
  });
});

describe('clearStallState', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('removes the row so the next decision is "fire" again', async () => {
    const id = unique();
    const now = '2026-05-23T12:00:00.000Z';
    await stallQ.markAlerted(TYPE, id, now);
    await stallQ.clearStallState(TYPE, id);
    expect(await stallQ.getStallState(TYPE, id)).toBeNull();
    expect(await stallQ.shouldFireStall(TYPE, id, addDaysIso(now, -5), now)).toBe('fire');
  });
});
