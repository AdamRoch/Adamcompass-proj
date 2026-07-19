/* eslint-disable */
/**
 * Compass Service Worker (vanilla, no Workbox).
 *
 * Strategy:
 *   - Install:   precache the app shell + offline fallback, then skipWaiting.
 *   - Activate:  drop old caches, take control of open clients, drain outbox.
 *   - Fetch:
 *       - Navigations: network-first, falling back to /offline.html.
 *       - POST /api/v1/captures (offline / network error): enqueue in IndexedDB
 *         and respond 202 with a synthetic JSON body so the UI can show a toast.
 *       - Other requests: passthrough.
 *   - Sync (Background Sync where supported): drain the outbox.
 *   - Message: drain the outbox when the page reports the network came back
 *     (iOS Safari path — no Background Sync there).
 *
 * IndexedDB: raw API, no `idb` dep. One DB ("compass-pwa"), one store ("outbox").
 */

const VERSION = 'v1';
const SHELL_CACHE = `compass-shell-${VERSION}`;
const RUNTIME_CACHE = `compass-runtime-${VERSION}`;
const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];
const OUTBOX_DB = 'compass-pwa';
const OUTBOX_DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const SYNC_TAG = 'compass-outbox-drain';

// ---------- Lifecycle ----------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Use individual fetches so a single 404 doesn't abort the install.
      await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res.clone());
          } catch (_) {
            /* ignore — best-effort */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
      // Opportunistically drain on activate (e.g. after an update).
      try {
        await replayAll();
      } catch (_) {
        /* ignore */
      }
    })(),
  );
});

// ---------- Fetch ----------

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin traffic; everything else passes through.
  if (url.origin !== self.location.origin) return;

  // Captures POST — try network, queue on failure / offline.
  if (req.method === 'POST' && url.pathname === '/api/v1/captures') {
    event.respondWith(handleCapturePost(req));
    return;
  }

  // Navigations — network-first with offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req));
    return;
  }

  // Same-origin GETs — stale-while-revalidate for static-ish files.
  if (req.method === 'GET' && isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(req));
    return;
  }

  // Everything else: passthrough.
});

function isStaticAsset(url) {
  // Next.js static assets + our own /public/ files.
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png' ||
    url.pathname === '/offline.html'
  );
}

async function handleNavigate(req) {
  try {
    const res = await fetch(req);
    return res;
  } catch (_) {
    const cache = await caches.open(SHELL_CACHE);
    const fallback = await cache.match('/offline.html');
    return (
      fallback ||
      new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

async function handleStaticAsset(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res?.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return new Response('Offline', { status: 503 });
}

async function handleCapturePost(req) {
  // Try the network first. If it succeeds, just return its response.
  // We clone the request so we still have the body to enqueue on failure.
  let cloned;
  try {
    cloned = req.clone();
  } catch (_) {
    cloned = req;
  }

  try {
    const res = await fetch(req);
    // Treat 5xx as a "queue it" signal too — origin is unreachable in practice.
    if (res && res.status < 500) {
      return res;
    }
    throw new Error(`upstream ${res ? res.status : 'no-response'}`);
  } catch (_) {
    return enqueueCaptureRequest(cloned);
  }
}

async function enqueueCaptureRequest(req) {
  try {
    const bodyText = await req.text();
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (_) {
      // If body wasn't JSON, we can't safely replay — fall back to error.
      return new Response(
        JSON.stringify({
          error: { code: 'offline_invalid_body', message: 'offline and body is not JSON' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const headers = {};
    req.headers.forEach((v, k) => {
      headers[k] = v;
    });

    await enqueueCapture({
      url: req.url,
      method: 'POST',
      headers,
      payload,
      queued_at: new Date().toISOString(),
    });

    // Register a background-sync drain attempt if available (Chromium).
    try {
      if (self.registration && 'sync' in self.registration) {
        await self.registration.sync.register(SYNC_TAG);
      }
    } catch (_) {
      /* not supported (e.g. iOS Safari) — page-driven replay will handle it */
    }

    // Synthetic accepted-but-queued response.
    const body = {
      queued: true,
      note: {
        id: payload?.idem_key ? `pending:${payload.idem_key}` : 'pending',
        body_markdown: payload?.body ? payload.body : '',
        inbox_type_hint: payload?.type_hint || 'unspecified',
        created_at: payload?.captured_at ? payload.captured_at : new Date().toISOString(),
        pending: true,
      },
      duplicate: false,
    };
    return new Response(JSON.stringify(body), {
      status: 202,
      headers: {
        'Content-Type': 'application/json',
        'X-Compass-Queued': '1',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: { code: 'offline_enqueue_failed', message: String(e?.message ? e.message : e) },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// ---------- Background Sync ----------

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayAll());
  }
});

// ---------- Page messages ----------

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'compass:drain-outbox') {
    event.waitUntil(replayAll());
  } else if (data.type === 'compass:skip-waiting') {
    self.skipWaiting();
  }
});

// ---------- IndexedDB outbox helpers ----------

function openOutboxDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, OUTBOX_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('queued_at', 'queued_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueCapture(entry) {
  const db = await openOutboxDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(OUTBOX_STORE).add(entry);
    });
  } finally {
    db.close();
  }
}

async function readAllEntries() {
  const db = await openOutboxDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const store = tx.objectStore(OUTBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function deleteEntry(id) {
  const db = await openOutboxDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(OUTBOX_STORE).delete(id);
    });
  } finally {
    db.close();
  }
}

async function replayAll() {
  let entries;
  try {
    entries = await readAllEntries();
  } catch (_) {
    return;
  }
  if (!entries || entries.length === 0) return;

  // Sort oldest-first so user sees them in capture order.
  entries.sort((a, b) => {
    const ta = a.queued_at || '';
    const tb = b.queued_at || '';
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return (a.id || 0) - (b.id || 0);
  });

  let succeededAny = false;
  for (const entry of entries) {
    try {
      const headers = new Headers(entry.headers || {});
      // Server dedupes via (client_id, idem_key) so replay is safe.
      const res = await fetch(entry.url, {
        method: entry.method || 'POST',
        headers,
        body: JSON.stringify(entry.payload),
      });
      if (res.ok || res.status === 200 || res.status === 201 || res.status === 409) {
        await deleteEntry(entry.id);
        succeededAny = true;
      } else if (
        res.status >= 400 &&
        res.status < 500 &&
        res.status !== 408 &&
        res.status !== 429
      ) {
        // Permanent client error — drop so we don't loop forever.
        await deleteEntry(entry.id);
      } else {
        // Transient: stop and let the next sync / online event retry.
        break;
      }
    } catch (_) {
      // Network error — stop, retry later.
      break;
    }
  }

  if (succeededAny) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    for (const client of clients) {
      try {
        client.postMessage({ type: 'compass:outbox-drained' });
      } catch (_) {
        /* ignore */
      }
    }
  }
}
