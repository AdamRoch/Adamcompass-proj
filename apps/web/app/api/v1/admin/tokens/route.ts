import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { hashToken, newRandomToken } from '@/lib/auth';
import * as adminQ from '@compass/db/queries/admin';
import * as authQ from '@compass/db/queries/auth';
import { ApiError } from '@compass/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const createTokenSchema = z.object({
  name: z.string().min(1).max(120),
  scope: z.enum(['cli', 'helper', 'webhook']),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.principal !== 'user') {
      throw new ApiError('forbidden', 'admin token list requires a user session', 403);
    }
    const tokens = await authQ.listTokens();
    return ok({ tokens });
  } catch (e) {
    return fromApiError(e);
  }
}

/**
 * Mint a new bearer token of the requested scope. The plain token is returned exactly once
 * in the response — store it now or revoke and re-mint.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.principal !== 'user') {
      throw new ApiError('forbidden', 'minting tokens requires a user session', 403);
    }
    const body = await readJson(req, createTokenSchema);
    const prefix = body.scope === 'cli' ? 'cpsc' : body.scope === 'helper' ? 'cpsh' : 'cpsw';
    const plain = newRandomToken(prefix);
    const created = await authQ.createToken({
      name: body.name,
      scope: body.scope,
      token_hash: hashToken(plain),
    });
    await adminQ.writeAudit({
      actor: 'user',
      action: 'token.mint',
      metadata: { token_id: created.id, scope: body.scope, name: body.name },
    });
    return ok({ token: { ...created, plain_once: plain } }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
