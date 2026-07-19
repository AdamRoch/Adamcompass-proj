// API response + validation helpers used by every /api/v1 route.
import 'server-only';
import { ApiError, type ErrorCode } from '@compass/shared';
import type { TokenScope } from '@compass/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { authenticateBearer, currentUser } from './auth.js';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function err(code: ErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function fromApiError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return err(e.code, e.message, e.status, e.details);
  }
  if (e instanceof ZodError) {
    return err('validation_failed', 'invalid request body', 422, e.flatten());
  }
  console.error('[api] unhandled', e);
  return err('internal', 'internal server error', 500);
}

export async function readJson<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S>> {
  const raw = await req.json().catch(() => {
    throw new ApiError('validation_failed', 'request body must be JSON', 400);
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('validation_failed', 'invalid request body', 422, parsed.error.flatten());
  }
  return parsed.data;
}

/**
 * Authenticate via cookie session OR bearer token. Returns the principal context.
 */
export async function requireAuth(
  req: NextRequest,
  requiredTokenScope?: TokenScope,
): Promise<{
  principal: 'user' | 'token';
  user_id?: string;
  token_id?: string;
  scope?: TokenScope;
}> {
  const auth = req.headers.get('authorization');
  // Only treat the header as an attempted bearer auth when it actually starts with "Bearer ".
  // If it's something else (e.g. "Basic …" leaked from a proxy), fall through to the session
  // cookie path instead of rejecting outright.
  if (auth && /^Bearer\s+/i.test(auth)) {
    const tok = await authenticateBearer(auth, requiredTokenScope);
    if (tok) return { principal: 'token', token_id: tok.token_id, scope: tok.scope };
    throw new ApiError('unauthenticated', 'invalid bearer token', 401);
  }
  const user = await currentUser();
  if (user) return { principal: 'user', user_id: user.id };
  throw new ApiError('unauthenticated', 'authentication required', 401);
}

/**
 * Simple in-memory token bucket rate limiter, keyed by client identifier.
 * Per-process state — fine for single-server v1.
 */
const buckets = new Map<string, { tokens: number; last: number }>();
export function rateLimit(key: string, perMinute = 60): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, last: now };
  const elapsedSec = (now - b.last) / 1000;
  const refill = elapsedSec * (perMinute / 60);
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}
