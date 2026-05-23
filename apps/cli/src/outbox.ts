// Append-only NDJSON outbox at ~/.compass/outbox.ndjson.
// Each line is a serialized capture request body (the same JSON the server expects),
// optionally with metadata. The line is removed only after the server acknowledges
// with 2xx OR 409 (duplicate). Network/5xx errors leave the line in place.

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import type { CompassClient } from '@compass/api-client';
import { CompassApiError } from '@compass/api-client';
import type { CaptureRequest } from '@compass/shared/zod';
import { ensureConfigDir, OUTBOX_PATH, updateLastContact } from './config.js';

/** A single queued capture. */
export interface OutboxEntry {
  /** Stable idempotency key (UUID v4). Generated once on enqueue, preserved on replay. */
  idem_key: string;
  /** Stable client identifier (host+user derived). */
  client_id: string;
  body: string;
  type_hint: 'idea' | 'note' | 'curiosity' | 'unspecified';
  tags: string[];
  captured_at: string;
  /** When this entry was first written to the outbox. */
  enqueued_at: string;
  /** Optional project target (skips Inbox by filing directly). */
  project_id?: string;
}

/** Append a new entry to the outbox. */
export async function appendOutbox(entry: OutboxEntry): Promise<void> {
  await ensureConfigDir();
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(OUTBOX_PATH, line, { encoding: 'utf8', mode: 0o600 });
}

/** Read all queued entries; tolerates partially-corrupt lines (they're dropped silently). */
export async function readOutbox(): Promise<OutboxEntry[]> {
  if (!existsSync(OUTBOX_PATH)) return [];
  const raw = await fs.readFile(OUTBOX_PATH, 'utf8');
  const out: OutboxEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isOutboxEntry(parsed)) out.push(parsed);
    } catch {
      // Drop unparseable lines silently — they would block the queue otherwise.
    }
  }
  return out;
}

/** Atomically rewrite the outbox with only the given entries (in order). */
export async function rewriteOutbox(entries: OutboxEntry[]): Promise<void> {
  await ensureConfigDir();
  if (entries.length === 0) {
    if (existsSync(OUTBOX_PATH)) await fs.unlink(OUTBOX_PATH);
    return;
  }
  const tmp = `${OUTBOX_PATH}.tmp`;
  const payload = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await fs.writeFile(tmp, payload, { mode: 0o600 });
  await fs.rename(tmp, OUTBOX_PATH);
}

export async function outboxLength(): Promise<number> {
  const entries = await readOutbox();
  return entries.length;
}

export interface ReplayResult {
  attempted: number;
  succeeded: number;
  failed: number;
  /** Human-readable summaries of failures (one per failed entry). */
  failures: string[];
}

/**
 * Try to drain the outbox. For each line: POST it; on 2xx or 409 (duplicate), drop the line.
 * On any other error (5xx, network), leave the line in place and stop only if it looks like
 * a network outage — but for v1, we keep trying every entry to surface per-entry validation
 * failures (which would otherwise block the queue forever; those get dropped with a warning).
 */
export async function replayOutbox(client: CompassClient): Promise<ReplayResult> {
  const entries = await readOutbox();
  if (entries.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0, failures: [] };
  }

  const remaining: OutboxEntry[] = [];
  const failures: string[] = [];
  let succeeded = 0;

  for (const entry of entries) {
    const req: CaptureRequest = toCaptureRequest(entry);
    try {
      await client.capture(req);
      succeeded += 1;
      await updateLastContact(new Date().toISOString());
    } catch (err) {
      if (err instanceof CompassApiError) {
        // 409 = duplicate => already accepted; drop.
        // 4xx (except 408/429) = validation/auth => dropping avoids a forever-stuck queue.
        // 5xx/408/429 = transient; keep.
        if (isAckStatus(err.status)) {
          succeeded += 1;
          await updateLastContact(new Date().toISOString());
        } else if (isTransientStatus(err.status)) {
          remaining.push(entry);
          failures.push(
            `entry ${entry.idem_key.slice(0, 8)}…: server returned ${err.status} (will retry)`,
          );
        } else {
          // Permanent client error — drop with a clear warning so a single bad entry doesn't
          // wedge every future send.
          failures.push(
            `entry ${entry.idem_key.slice(0, 8)}… dropped: server returned ${err.status} (${describeApiError(err)})`,
          );
        }
      } else {
        // Network error — keep the entry, retry next invocation.
        remaining.push(entry);
        failures.push(`entry ${entry.idem_key.slice(0, 8)}…: ${describeUnknownError(err)} (will retry)`);
      }
    }
  }

  await rewriteOutbox(remaining);
  return {
    attempted: entries.length,
    succeeded,
    failed: remaining.length,
    failures,
  };
}

/** Build the CaptureRequest payload for the server from an outbox entry. */
export function toCaptureRequest(entry: OutboxEntry): CaptureRequest {
  return {
    idem_key: entry.idem_key,
    client_id: entry.client_id,
    body: entry.body,
    type_hint: entry.type_hint,
    tags: entry.tags,
    captured_at: entry.captured_at,
  };
}

function isOutboxEntry(v: unknown): v is OutboxEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.idem_key === 'string' &&
    typeof o.client_id === 'string' &&
    typeof o.body === 'string' &&
    typeof o.type_hint === 'string' &&
    Array.isArray(o.tags) &&
    typeof o.captured_at === 'string' &&
    typeof o.enqueued_at === 'string'
  );
}

function isAckStatus(status: number): boolean {
  return (status >= 200 && status < 300) || status === 409;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function describeApiError(err: CompassApiError): string {
  const body = err.body as { error?: { code?: string; message?: string } } | null;
  return body?.error?.message ?? body?.error?.code ?? `HTTP ${err.status}`;
}

function describeUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
