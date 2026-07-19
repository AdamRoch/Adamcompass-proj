import { newUlid, nowIso } from '@compass/shared';
import { desc } from 'drizzle-orm';
import { getDb } from '../index.js';

export async function writeAudit(input: {
  actor: 'user' | 'cli' | 'helper' | 'webhook' | 'scheduler' | 'system';
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}) {
  const handle = getDb();
  await handle.db.insert(handle.schema.audit_log).values({
    id: newUlid(),
    actor: input.actor,
    action: input.action,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    metadata_json: JSON.stringify(input.metadata ?? {}),
    at: nowIso(),
  });
}

export async function listAudit(limit = 200) {
  const handle = getDb();
  return await handle.db
    .select()
    .from(handle.schema.audit_log)
    .orderBy(desc(handle.schema.audit_log.at))
    .limit(limit);
}
