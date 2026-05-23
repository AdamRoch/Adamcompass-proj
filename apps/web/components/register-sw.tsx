'use client';

/**
 * Registers the Compass service worker (`/sw.js`) on mount and bridges the
 * browser's `online` event to the worker so it can drain its IndexedDB outbox.
 *
 * Why a bridge?
 *   - Background Sync drains the outbox in the background on Chromium.
 *   - iOS Safari (as of 2026) does not implement Background Sync, so the only
 *     reliable signal that connectivity returned is the page-level `online`
 *     event. We post a message to the SW which calls its `replayAll()`.
 *
 * Also listens for `compass:outbox-drained` messages from the SW so the rest
 * of the app can react via a CustomEvent on `window` (e.g. show a toast,
 * refresh the inbox list).
 */
import { useEffect } from 'react';

const SW_URL = '/sw.js';

export function RegisterSW(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const pingDrain = () => {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        controller.postMessage({ type: 'compass:drain-outbox' });
      } else if (registration && registration.active) {
        registration.active.postMessage({ type: 'compass:drain-outbox' });
      }
    };

    const handleOnline = () => {
      pingDrain();
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'compass:outbox-drained') {
        window.dispatchEvent(new CustomEvent('compass:outbox-drained'));
      }
    };

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
        if (cancelled) return;
        registration = reg;

        // If we come online while the page is already up, drain immediately.
        window.addEventListener('online', handleOnline);

        // If we're already online and a SW exists, drain on page-load too —
        // covers the iOS PWA case where the user opens the app fresh after
        // being offline.
        if (navigator.onLine) {
          // Wait until there's a controller (i.e. a SW is in charge of fetches).
          if (navigator.serviceWorker.controller) {
            pingDrain();
          } else {
            navigator.serviceWorker.addEventListener('controllerchange', pingDrain, {
              once: true,
            });
          }
        }

        navigator.serviceWorker.addEventListener('message', handleMessage);
      } catch (err) {
        // Registration failure is non-fatal — the app still works online.
        console.warn('[compass] service worker registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  return null;
}

export default RegisterSW;
