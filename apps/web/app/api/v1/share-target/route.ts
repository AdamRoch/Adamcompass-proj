/**
 * Web Share Target endpoint.
 *
 * Registered in `/public/manifest.webmanifest` as a GET share_target. When the user
 * shares a page / text from another app on a device with Compass installed as a PWA,
 * the OS hands us `title`, `text`, `url` as query params.
 *
 * We compose them into a capture body, call createCapture directly (with a stable
 * idem_key derived from a hash of the composed payload so re-shares de-dupe), then
 * redirect to /inbox?shared=1.
 *
 * Auth note: the request comes from the OS browser navigation, so cookie auth
 * applies — the user must be signed into the PWA. If unauthenticated, we bounce
 * to /login with a return path that brings them back through the share flow.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import * as capturesQ from '@compass/db/queries/captures';
import { indexNote } from '@/lib/index-entity';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const title = (url.searchParams.get('title') || '').trim();
  const text = (url.searchParams.get('text') || '').trim();
  const sharedUrl = (url.searchParams.get('url') || '').trim();

  // Compose body: [title?] + text + url?, newline-joined, skipping blanks.
  const parts = [title, text, sharedUrl].filter((p) => p.length > 0);
  const body = parts.join('\n').trim();

  // Nothing to capture — just bounce to inbox.
  if (!body) {
    return NextResponse.redirect(new URL('/inbox', url.origin), 303);
  }

  // Auth: this is a cookie-protected browser navigation. If not signed in, send
  // the user to /login; once they return, the share params are gone, so we
  // include them in `next` so the login redirect can replay the share.
  const user = await currentUser();
  if (!user) {
    const next = new URL('/api/v1/share-target', url.origin);
    next.search = url.search;
    const login = new URL('/login', url.origin);
    login.searchParams.set('next', next.pathname + next.search);
    return NextResponse.redirect(login, 303);
  }

  // Stable idem_key: SHA-256 of the canonical composed body. Re-sharing the
  // exact same content yields the same key, so createCapture's (client_id,
  // idem_key) dedupe makes it a no-op.
  const hash = createHash('sha256').update(body).digest('hex');
  // The capture-request schema requires 8..128 chars; truncate to 64 hex (256 bits worth).
  const idem_key = `share:${hash.slice(0, 56)}`;
  const client_id = `pwa-share-target:${user.id}`;

  try {
    const result = await capturesQ.createCapture({
      idem_key,
      client_id,
      body,
      type_hint: 'unspecified',
      tags: [],
      captured_at: new Date().toISOString(),
    });
    // Index in search (skip if it was a dedupe — already indexed previously).
    if (!result.duplicate) {
      try {
        await indexNote(result.note_id);
      } catch (e) {
        // Best-effort; the capture itself succeeded.
        console.error('[share-target] index failed', e);
      }
    }
  } catch (e) {
    console.error('[share-target] capture failed', e);
    const failUrl = new URL('/inbox', url.origin);
    failUrl.searchParams.set('shared', 'error');
    return NextResponse.redirect(failUrl, 303);
  }

  const dest = new URL('/inbox', url.origin);
  dest.searchParams.set('shared', '1');
  return NextResponse.redirect(dest, 303);
}
