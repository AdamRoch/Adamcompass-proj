import { DEFAULT_SETTINGS, type Settings, newUlid, nowIso } from '@compass/shared';
import { eq } from 'drizzle-orm';
import { getDb } from '../index.js';

export async function getSettings(): Promise<Settings> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.settings)
    .where(eq(handle.schema.settings.id, 'SINGLETON'))
    .limit(1);
  if (!rows[0]) {
    // Lazy init
    await handle.db.insert(handle.schema.settings).values({
      id: 'SINGLETON',
      data_json: JSON.stringify(DEFAULT_SETTINGS),
      updated_at: nowIso(),
    });
    return DEFAULT_SETTINGS;
  }
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(rows[0].data_json) as Partial<Settings>) };
  } catch (err) {
    // Bad data_json: log, write to audit_log, return defaults so the app keeps working.
    console.error('[settings] data_json parse failed', err);
    try {
      await handle.db.insert(handle.schema.audit_log).values({
        id: newUlid(),
        actor: 'system',
        action: 'settings.data_json.parse_failed',
        entity_type: null,
        entity_id: null,
        metadata_json: JSON.stringify({ error: String(err) }),
        at: nowIso(),
      });
    } catch (auditErr) {
      console.error('[settings] audit_log write failed', auditErr);
    }
    return DEFAULT_SETTINGS;
  }
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const handle = getDb();
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await handle.db
    .update(handle.schema.settings)
    .set({ data_json: JSON.stringify(next), updated_at: nowIso() })
    .where(eq(handle.schema.settings.id, 'SINGLETON'));
  return next;
}
