# Compass PWA

Compass ships as a Progressive Web App. Installed on mobile (or desktop, via the browser's "install" affordance), it gets its own icon, runs in a standalone window, registers as a Web Share Target, and queues offline captures locally.

This document covers the moving parts and the known limitations.

## Files

| Path | Role |
|---|---|
| `public/manifest.webmanifest` | Web App Manifest — name, icons, start_url, display mode, `share_target`, shortcuts. |
| `public/sw.js` | Service worker. Vanilla JS, no Workbox. Handles install / activate / fetch / sync / message. |
| `public/offline.html` | Static offline fallback page used by the SW when a navigation has no network and no cache. |
| `public/favicon.svg` | App brand mark (a stylized compass needle), monochrome, theme-aware via `currentColor`. |
| `public/icon-192.png`, `public/icon-512.png` | Maskable icons referenced by the manifest. **Currently placeholders** (see `public/README-icons.md`). |
| `app/api/v1/share-target/route.ts` | Server route that handles incoming Web Share Target GETs and creates an idempotent capture. |
| `components/register-sw.tsx` | Client component that registers `/sw.js` and bridges `online` events into the SW. |

## How it fits together

1. The root layout loads `manifest.webmanifest` (already wired in `app/layout.tsx`) and the `RegisterSW` client component (must be mounted in the app shell, typically via the `Providers` component used by `(app)/layout.tsx`; alternatively, render it inside the root layout's `<body>`).
2. On first page-load with a supporting browser, the SW installs and pre-caches the offline fallback + manifest + icons.
3. The SW intercepts:
   - **Navigations** — network-first; if the network is unreachable, returns `offline.html` from the cache.
   - **`POST /api/v1/captures`** — tries the network; on failure (or 5xx), the request body is stored in an IndexedDB outbox (`compass-pwa` / `outbox`) and the SW returns a synthetic `202 { queued: true, note: {…, pending: true} }` body. The capture UI should treat this as success and show a "Queued offline" toast.
   - **Static assets** (`/_next/static/...`, favicon, icons, manifest) — stale-while-revalidate from a runtime cache.
4. When connectivity returns, the SW drains the outbox by replaying each request. The server's `(client_id, idem_key)` dedupe guarantees replay safety.

## Web Share Target

Registered in the manifest:

```json
"share_target": {
  "action": "/api/v1/share-target",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

The endpoint composes `[title?] + text + url?` (newline-joined, blanks dropped), hashes the composed body with SHA-256 to derive a stable idem_key (`share:<56-hex>`), calls `createCapture` directly, and redirects to `/inbox?shared=1`. Re-sharing the same content de-dupes server-side and the redirect is a no-op visually.

The endpoint is cookie-protected — if the user shares while not signed in, they're redirected to `/login?next=…` with the share params preserved so the share resumes after login.

## App shortcuts

Long-press the installed icon to access:

- **Capture** → `/?capture=1` (deep link the dashboard reads to auto-open the capture modal).
- **Inbox** → `/inbox`.

## Outbox replay paths

| Trigger | Browsers | Notes |
|---|---|---|
| `sync` event with tag `compass-outbox-drain` | Chromium-based (Chrome, Edge, Brave, Android Chrome) | True background drain — fires even if the PWA isn't open. Registered by the SW after every successful enqueue. |
| SW `activate` event | All | Best-effort drain when the SW takes over (e.g. after an update). |
| `online` event on the page → `postMessage('compass:drain-outbox')` to the SW | All (the iOS Safari fallback) | The page listens to `window.online` and pings the SW; the SW then calls `replayAll()`. |
| Page load / controllerchange (when `navigator.onLine` is true) | All | Catches the case where the user was offline, closed the app, and reopened it later. |

The SW posts `compass:outbox-drained` back to all client pages after a successful drain — the UI listens for this `CustomEvent` on `window` to re-fetch the inbox list / show a "synced" toast.

## iOS-specific caveats

iOS Safari (verified through Safari 18 / 2026) has the following limitations that shaped the design above:

1. **No Background Sync API.** `self.registration.sync.register(...)` will throw or be `undefined`. The SW still queues captures; replay happens at the next opportunity — usually when the user reopens the app or when the page receives the `online` event. This is documented behaviour, not a bug.
2. **No Periodic Background Sync** either — the app cannot poll on its own when closed.
3. **No push notifications** without going through Apple Push Notification Service plumbing for installed PWAs (iOS 16.4+ does support it for installed PWAs, but Compass v1 uses Telegram for all notifications and intentionally skips web push).
4. **`display: standalone` quirks.** External `target="_blank"` links sometimes open in an in-app browser instead of full Safari. Not a Compass problem to solve in v1.
5. **Storage eviction.** Safari may evict IndexedDB after ~7 days of non-use. Critical captures should still flow through the CLI or the always-online web path for true durability — the offline queue is best-effort, not archival storage.
6. **Install requires "Add to Home Screen"** from the Share sheet; there is no browser-driven install prompt event (`beforeinstallprompt`). Document this in user-facing help copy.
7. **Maskable icons aren't honored** the same way as Android — iOS applies its own rounded-rect mask. Test the 512x512 artwork manually after replacing the placeholder PNG.

## Android & desktop Chromium notes

- The install prompt event (`beforeinstallprompt`) fires; you can defer + show your own UI. Not implemented in v1 — the browser's default install UI is acceptable.
- Background Sync works as designed. Outbox drains even when the PWA is closed.
- Web Share Target receives both `text` and `url`; Android Chrome usually splits a shared link between them, which is why the server endpoint concatenates all three with newlines.

## Mounting RegisterSW

`RegisterSW` is a pure client component. Add it once — typically inside the `Providers` component the `(app)` layout uses, or directly inside `<body>` in the root layout. It returns `null` and does nothing on the server.

```tsx
import { RegisterSW } from '@/components/register-sw';

// inside Providers or layout.tsx
<>
  <RegisterSW />
  {children}
</>
```

## Updating the service worker

Bump the `VERSION` constant at the top of `public/sw.js`. The new SW will install, drop stale caches in `activate`, take control via `clients.claim()`, and drain any outstanding outbox entries.

For a faster takeover during development, a page can post `{ type: 'compass:skip-waiting' }` to the waiting SW.

## Security & captures-at-rest

Per the Implementation PRD §14: **captures queued on disk (and in IndexedDB) are not encrypted at rest in v1.** This applies to the PWA outbox the same way it applies to the CLI's flat-file outbox and the menubar helper's SQLite outbox. Treat the device as trusted; full at-rest encryption is a v2 hardening item.
