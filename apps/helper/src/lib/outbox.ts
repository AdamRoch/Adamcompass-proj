// Thin TS wrappers around the Rust SQLite outbox. The Rust side owns the
// database connection so we get a single writer and avoid native-module
// trouble in the WebView. The replay loop also lives in Rust.

import { invoke } from '@tauri-apps/api/core';
import type { CaptureRequest } from '@compass/shared/zod';

export interface OutboxStats {
  pending: number;
  last_attempt_at: string | null;
  last_error: string | null;
}

export async function enqueueCapture(req: CaptureRequest): Promise<void> {
  // Rust serializes and persists; the replay thread will pick it up.
  await invoke('cmd_enqueue_capture', { body: JSON.stringify(req) });
}

export async function getOutboxStats(): Promise<OutboxStats> {
  return invoke<OutboxStats>('cmd_outbox_stats');
}

// Used by the popover after a synchronous attempt has succeeded — keeps the
// queue lean by not even round-tripping a row when the network is up.
// (The Rust side accepts the row only on failure; no-op via wrapper.)
export async function flushNow(): Promise<void> {
  await invoke('cmd_outbox_flush');
}
