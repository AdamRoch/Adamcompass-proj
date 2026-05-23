import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as projectsQ from '../queries/projects.js';

describe('projects queries', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('createProject inserts with defaults and writes a created activity_event', async () => {
    const p = await projectsQ.createProject({
      title: 'Compass',
      summary: 'self-tracking dashboard',
    });
    expect(p.title).toBe('Compass');
    expect(p.stage).toBe('idea');
    expect(p.status).toBe('active');
    expect(p.created_at).toBe(p.last_touched_at);

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const evts = raw
      .prepare(`SELECT event_type FROM activity_event WHERE entity_type='project' AND entity_id=?`)
      .all(p.id) as Array<{ event_type: string }>;
    expect(evts.some((e) => e.event_type === 'created')).toBe(true);
  });

  it('updateProject with a new stage writes a stage_changed event and bumps last_touched_at', async () => {
    const p = await projectsQ.createProject({ title: 'Stage transitions' });
    const originalTouched = p.last_touched_at;
    // Ensure a small clock movement so timestamps differ.
    await new Promise((r) => setTimeout(r, 10));
    const updated = await projectsQ.updateProject(p.id, { stage: 'building' });
    expect(updated!.stage).toBe('building');
    expect(updated!.last_touched_at > originalTouched).toBe(true);

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const evts = raw
      .prepare(
        `SELECT event_type, payload_json FROM activity_event WHERE entity_type='project' AND entity_id=? ORDER BY occurred_at`,
      )
      .all(p.id) as Array<{ event_type: string; payload_json: string }>;
    const stageEvt = evts.find((e) => e.event_type === 'stage_changed');
    expect(stageEvt).toBeTruthy();
    const payload = JSON.parse(stageEvt!.payload_json);
    expect(payload.from).toBe('idea');
    expect(payload.to).toBe('building');
  });

  it('updateProject without a stage change writes a generic updated event with fields list', async () => {
    const p = await projectsQ.createProject({ title: 'Just summary' });
    const updated = await projectsQ.updateProject(p.id, { summary: 'new summary' });
    expect(updated!.summary).toBe('new summary');

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const evts = raw
      .prepare(`SELECT event_type, payload_json FROM activity_event WHERE entity_id=?`)
      .all(p.id) as Array<{ event_type: string; payload_json: string }>;
    const u = evts.find((e) => e.event_type === 'updated');
    expect(u).toBeTruthy();
    expect(JSON.parse(u!.payload_json).fields).toContain('summary');
  });

  it('snooze + unsnooze round-trip clears the snooze fields and writes events', async () => {
    const p = await projectsQ.createProject({ title: 'Snooze me' });
    const until = '2026-06-01T00:00:00.000Z';
    const snoozed = await projectsQ.snoozeProject(p.id, until, 'waiting on deps');
    expect(snoozed!.snoozed_until).toBe(until);
    expect(snoozed!.snooze_reason).toBe('waiting on deps');

    const unsnoozed = await projectsQ.unsnoozeProject(p.id);
    expect(unsnoozed!.snoozed_until).toBeNull();
    expect(unsnoozed!.snooze_reason).toBeNull();

    const handle = (await import('@compass/db')).getDb();
    const raw = handle.raw as Database.Database;
    const evts = raw
      .prepare(`SELECT event_type FROM activity_event WHERE entity_id=? ORDER BY occurred_at`)
      .all(p.id) as Array<{ event_type: string }>;
    expect(evts.some((e) => e.event_type === 'snoozed')).toBe(true);
    expect(evts.some((e) => e.event_type === 'unsnoozed')).toBe(true);
  });

  it('archiveProject sets stage to archived (via updateProject path)', async () => {
    const p = await projectsQ.createProject({ title: 'Going away' });
    const archived = await projectsQ.archiveProject(p.id);
    expect(archived!.stage).toBe('archived');
  });

  it('listProjects excludes archived by default and includes them when asked', async () => {
    const live = await projectsQ.createProject({ title: 'Live' });
    const dead = await projectsQ.createProject({ title: 'Dead' });
    await projectsQ.archiveProject(dead.id);

    const visible = await projectsQ.listProjects({});
    const visibleIds = visible.map((p) => p.id);
    expect(visibleIds).toContain(live.id);
    expect(visibleIds).not.toContain(dead.id);

    const all = await projectsQ.listProjects({ includeArchived: true });
    const allIds = all.map((p) => p.id);
    expect(allIds).toContain(dead.id);
  });
});
