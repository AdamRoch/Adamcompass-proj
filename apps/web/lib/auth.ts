// Session + bearer-token auth helpers.
// Session: HMAC-signed cookie containing user_id + iat. Verified on every request to (app)/ + API.
// Bearer: Authorization header validated against auth_token table (sha256 hash compared).

import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as authQ from '@compass/db/queries/auth';
import type { TokenScope } from '@compass/shared';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'compass_session';
const SESSION_TTL_DAYS = 30;

function sessionSecret(): string {
  const s = process.env.COMPASS_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('COMPASS_SESSION_SECRET must be at least 16 chars');
  }
  return s;
}

interface SessionPayload {
  uid: string;
  iat: number; // seconds
}

function sign(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(cookie: string): SessionPayload | null {
  const i = cookie.indexOf('.');
  if (i < 0) return null;
  const body = cookie.slice(0, i);
  const sig = cookie.slice(i + 1);
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  // base64url strings are ASCII-only, so 'ascii' is the cheapest correct decode for the
  // constant-time compare. 'utf8' worked but was wasteful and slightly misleading.
  const a = Buffer.from(sig, 'ascii');
  const b = Buffer.from(expected, 'ascii');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    const maxAgeSec = SESSION_TTL_DAYS * 86400;
    if (Date.now() / 1000 - payload.iat > maxAgeSec) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSession(userId: string) {
  const cookie = sign({ uid: userId, iat: Math.floor(Date.now() / 1000) });
  (await cookies()).set(COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 86400,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function currentUser() {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const session = verify(cookie);
  if (!session) return null;
  const user = await authQ.getUserById(session.uid);
  return user;
}

export async function requireUserOrRedirect(toRoute = '/login') {
  const u = await currentUser();
  if (!u) redirect(toRoute);
  return u!;
}

// ---- Password ----

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ---- Bearer token ----

function tokenPepper(): string {
  const p = process.env.COMPASS_TOKEN_PEPPER;
  if (!p || p.length < 16) {
    // instrumentation.ts boot validation should have already failed; this is a defence-in-depth.
    throw new Error('COMPASS_TOKEN_PEPPER must be at least 16 chars');
  }
  return p;
}

// Random 24-byte tokens (~192 bits of entropy) only need a 1-pass hash. We add a server-side
// pepper so a stolen DB dump alone cannot be used to verify a guessed token without also
// stealing COMPASS_TOKEN_PEPPER from the host process environment.
export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).update('\x00').update(tokenPepper()).digest('hex');
}

export function newRandomToken(prefix = 'cps'): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

// In-memory throttle for markTokenUsed: a CLI may make many calls per minute, but we only
// need ~minute-grain resolution on last_used_at. Skipping repeats avoids a write per request.
const tokenUsedLastWriteMs = new Map<string, number>();
const TOKEN_USED_THROTTLE_MS = 60_000;

export async function authenticateBearer(
  authorization: string | null,
  requiredScope?: TokenScope,
): Promise<{ token_id: string; scope: TokenScope } | null> {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const plain = m[1]?.trim();
  if (!plain) return null;
  const hashed = hashToken(plain);
  const row = await authQ.findActiveTokenByHash(hashed, requiredScope);
  if (!row) return null;
  const now = Date.now();
  const last = tokenUsedLastWriteMs.get(row.id) ?? 0;
  if (now - last > TOKEN_USED_THROTTLE_MS) {
    tokenUsedLastWriteMs.set(row.id, now);
    await authQ.markTokenUsed(row.id);
  }
  return { token_id: row.id, scope: row.scope as TokenScope };
}

// ---- Bootstrap (ensure single user) ----

export async function ensureSingleUserExists(email: string, password: string) {
  const existing = await authQ.getUserByEmail(email);
  if (existing) return existing;
  const password_hash = await hashPassword(password);
  return await authQ.createUser({ email, password_hash });
}

// ---- CSRF tokens (server-action protection) ----

// Tokens are HMAC(session_secret, `${userId}|${issuedAtMs}`). Embed in the hidden input,
// verify on POST. Lifetime configurable, default 15min.
const CSRF_TTL_MS = 15 * 60 * 1000;

export function issueCsrfToken(userId: string, nowMs: number = Date.now()): string {
  const body = `${userId}|${nowMs}`;
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${Buffer.from(body, 'utf8').toString('base64url')}.${sig}`;
}

export function verifyCsrfToken(
  token: string | null | undefined,
  userId: string,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return false;
  const i = token.indexOf('.');
  if (i < 0) return false;
  const bodyB64 = token.slice(0, i);
  const sig = token.slice(i + 1);
  let body: string;
  try {
    body = Buffer.from(bodyB64, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig, 'ascii');
  const b = Buffer.from(expected, 'ascii');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const [uid, iatStr] = body.split('|');
  if (uid !== userId) return false;
  const iat = Number(iatStr ?? '0');
  if (!Number.isFinite(iat)) return false;
  if (nowMs - iat > CSRF_TTL_MS) return false;
  if (iat - nowMs > 60_000) return false; // future-dated, reject
  return true;
}
