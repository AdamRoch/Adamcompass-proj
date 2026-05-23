'use client';

/**
 * Stable per-session client identifier for the web capture surface.
 *
 * Per docs/Compass-Implementation-PRD.md §8, every capture POST must include a
 * `client_id` so the server can build a `(client_id, idem_key)` dedupe pair.
 * The web app's id format is `web-<uuid>`; the uuid is generated lazily on
 * first call and persisted to `sessionStorage` so a single tab/session reuses
 * the same id for the lifetime of that session.
 *
 * Notes:
 * - sessionStorage (not localStorage) by design — each new tab is a fresh
 *   "session" from the server's dedupe perspective, which avoids cross-tab
 *   idem-key collisions and matches the spec's `web-<session>` shape.
 * - SSR-safe: returns a placeholder when `window` is undefined. Callers
 *   should only invoke this from event handlers (post-mount), so the
 *   placeholder branch is defensive only.
 */

const STORAGE_KEY = 'compass.client_id';
const SSR_PLACEHOLDER = 'web-ssr';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Extremely defensive fallback for legacy environments without crypto.randomUUID.
  // RFC4122 v4-ish; uses Math.random — fine for client correlation, not for security.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Read (or lazily create + persist) the `web-<uuid>` client id for this tab session.
 */
export function getClientId(): string {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return SSR_PLACEHOLDER;
  }
  try {
    let id = window.sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUuid();
      window.sessionStorage.setItem(STORAGE_KEY, id);
    }
    return `web-${id}`;
  } catch {
    // sessionStorage can throw in private modes / quota'd contexts — fall back
    // to a per-call random id so capture still works, just without dedupe across
    // retries in this tab.
    return `web-${generateUuid()}`;
  }
}
