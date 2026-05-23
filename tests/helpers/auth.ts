// Bearer token + session helpers for integration tests.
//
// `createBearer` inserts a real auth_token row whose `token_hash` matches the recipe used by
// apps/web/lib/auth.ts: `sha256(plain || 0x00 || COMPASS_TOKEN_PEPPER)`. Returns
// `Bearer <plain>` ready to drop into `Authorization` headers.
//
// `signSessionCookie` mints a session cookie compatible with apps/web/lib/auth.ts so we can
// exercise routes that accept cookie sessions in addition to bearer auth.

import { createHash, createHmac } from 'node:crypto';
import * as authQ from '../../packages/db/src/queries/auth.js';

function hashTokenForTest(plain: string): string {
  const pepper = process.env.COMPASS_TOKEN_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new Error(
      'COMPASS_TOKEN_PEPPER not set (or <16 chars). tests/setup.ts should set this before each test.',
    );
  }
  return createHash('sha256').update(plain).update('\x00').update(pepper).digest('hex');
}

export async function createBearer(opts: {
  scope: 'cli' | 'helper' | 'webhook';
  name?: string;
  plaintext?: string;
}) {
  const plain = opts.plaintext ?? `tok_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const token_hash = hashTokenForTest(plain);
  const row = await authQ.createToken({
    name: opts.name ?? `test-${opts.scope}`,
    scope: opts.scope,
    token_hash,
  });
  return { id: row.id, plain, header: `Bearer ${plain}` };
}

export function signSessionCookie(userId: string): string {
  const secret = process.env.COMPASS_SESSION_SECRET;
  if (!secret) throw new Error('COMPASS_SESSION_SECRET not set');
  const payload = { uid: userId, iat: Math.floor(Date.now() / 1000) };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
