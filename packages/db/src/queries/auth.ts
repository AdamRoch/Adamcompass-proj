import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { newUlid, nowIso, type TokenScope } from '@compass/shared';
import { getDb } from '../index.js';

export async function getUserByEmail(email: string) {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.user)
    .where(eq(handle.schema.user.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.user)
    .where(eq(handle.schema.user.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSingleUser() {
  const handle = getDb();
  const rows = await handle.db.select().from(handle.schema.user).limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: { email: string; password_hash: string }) {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.user).values({
    id,
    email: input.email,
    password_hash: input.password_hash,
    created_at: now,
  });
  return { id, email: input.email, created_at: now };
}

export async function recordLogin(userId: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.user)
    .set({ last_login_at: nowIso() })
    .where(eq(handle.schema.user.id, userId));
}

// ---- Auth tokens (bearer, hashed) ----

export async function listTokens() {
  const handle = getDb();
  return await handle.db
    .select({
      id: handle.schema.auth_token.id,
      name: handle.schema.auth_token.name,
      scope: handle.schema.auth_token.scope,
      created_at: handle.schema.auth_token.created_at,
      last_used_at: handle.schema.auth_token.last_used_at,
      revoked_at: handle.schema.auth_token.revoked_at,
    })
    .from(handle.schema.auth_token);
}

export async function createToken(input: {
  name: string;
  scope: TokenScope;
  token_hash: string;
}) {
  const handle = getDb();
  const id = newUlid();
  const now = nowIso();
  await handle.db.insert(handle.schema.auth_token).values({
    id,
    name: input.name,
    token_hash: input.token_hash,
    scope: input.scope,
    created_at: now,
  });
  return { id, name: input.name, scope: input.scope, created_at: now };
}

export async function findActiveTokenByHash(token_hash: string, scope?: TokenScope) {
  const handle = getDb();
  const conds = [
    eq(handle.schema.auth_token.token_hash, token_hash),
    isNull(handle.schema.auth_token.revoked_at),
  ];
  if (scope) conds.push(eq(handle.schema.auth_token.scope, scope));
  const rows = await handle.db
    .select()
    .from(handle.schema.auth_token)
    .where(and(...conds))
    .limit(1);
  return rows[0] ?? null;
}

export async function markTokenUsed(id: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.auth_token)
    .set({ last_used_at: nowIso() })
    .where(eq(handle.schema.auth_token.id, id));
}

export async function revokeToken(id: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.auth_token)
    .set({ revoked_at: nowIso() })
    .where(eq(handle.schema.auth_token.id, id));
}

// ---- Device-code flow ----

export async function createDeviceCode(input: {
  device_code: string;
  user_code: string;
  scope: 'cli' | 'helper';
  ttl_seconds: number;
}) {
  const handle = getDb();
  const now = new Date();
  const expires = new Date(now.getTime() + input.ttl_seconds * 1000).toISOString();
  await handle.db.insert(handle.schema.device_code).values({
    device_code: input.device_code,
    user_code: input.user_code,
    scope: input.scope,
    created_at: now.toISOString(),
    expires_at: expires,
  });
  return { device_code: input.device_code, user_code: input.user_code, expires_at: expires };
}

export async function getDeviceCode(device_code: string) {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.device_code)
    .where(eq(handle.schema.device_code.device_code, device_code))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDeviceCodeByUserCode(user_code: string) {
  const handle = getDb();
  const rows = await handle.db
    .select()
    .from(handle.schema.device_code)
    .where(
      and(
        eq(handle.schema.device_code.user_code, user_code),
        gte(handle.schema.device_code.expires_at, nowIso()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function approveDeviceCode(device_code: string, token_id: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.device_code)
    .set({ approved: true, token_id })
    .where(eq(handle.schema.device_code.device_code, device_code));
}

export async function denyDeviceCode(device_code: string) {
  const handle = getDb();
  await handle.db
    .update(handle.schema.device_code)
    .set({ denied: true })
    .where(eq(handle.schema.device_code.device_code, device_code));
}

/** Hard-delete a device_code row. Used immediately after a successful poll so the plain
 *  token stashed in `token_id` does not persist. Also called by the cleanup sweeper. */
export async function deleteDeviceCode(device_code: string) {
  const handle = getDb();
  await handle.db
    .delete(handle.schema.device_code)
    .where(eq(handle.schema.device_code.device_code, device_code));
}

/** Sweep expired device_code rows. Called from a scheduler tick. */
export async function purgeExpiredDeviceCodes(nowIsoStr: string) {
  const handle = getDb();
  await handle.db
    .delete(handle.schema.device_code)
    .where(lt(handle.schema.device_code.expires_at, nowIsoStr));
}
