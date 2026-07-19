import { type WebhookDeliveryStatus, newUlid, nowIso } from '@compass/shared';
import { desc } from 'drizzle-orm';
import { getDb } from '../index.js';

export interface WebhookDeliveryRow {
  id: string;
  endpoint: string;
  received_at: string;
  headers_json: string;
  body_text: string;
  status: WebhookDeliveryStatus;
  dedup_key: string | null;
  error_message: string | null;
}

// Cap persisted webhook body to 64KB so a hostile or buggy producer cannot bloat the table.
const MAX_BODY_BYTES = 64 * 1024;
function capBodyText(body: string): string {
  const len = Buffer.byteLength(body, 'utf8');
  if (len <= MAX_BODY_BYTES) return body;
  const buf = Buffer.from(body, 'utf8').subarray(0, MAX_BODY_BYTES);
  return `${buf.toString('utf8')}\n[truncated: original ${len}B]`;
}

export async function record(input: {
  endpoint: string;
  headers: Record<string, string | string[] | undefined>;
  body_text: string;
  status: WebhookDeliveryStatus;
  dedup_key?: string;
  error?: string;
}): Promise<WebhookDeliveryRow> {
  const handle = getDb();
  const id = newUlid();
  const row: WebhookDeliveryRow = {
    id,
    endpoint: input.endpoint,
    received_at: nowIso(),
    headers_json: JSON.stringify(input.headers),
    body_text: capBodyText(input.body_text),
    status: input.status,
    dedup_key: input.dedup_key ?? null,
    error_message: input.error ?? null,
  };
  await handle.db.insert(handle.schema.webhook_deliveries).values(row);
  return row;
}

export async function listRecent(limit = 200): Promise<WebhookDeliveryRow[]> {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.webhook_deliveries)
    .orderBy(desc(handle.schema.webhook_deliveries.received_at))
    .limit(limit);
  return rows as WebhookDeliveryRow[];
}
