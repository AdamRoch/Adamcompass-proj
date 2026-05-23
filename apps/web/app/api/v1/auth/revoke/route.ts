import type { NextRequest } from 'next/server';
import * as authQ from '@compass/db/queries/auth';
import { authenticateBearer } from '@/lib/auth';
import { fromApiError, ok } from '@/lib/api';

// CLI/helper calls this on logout to revoke their own token.
export async function POST(req: NextRequest) {
  try {
    const tok = await authenticateBearer(req.headers.get('authorization'));
    if (!tok) {
      return ok({ ok: true, revoked: false });
    }
    await authQ.revokeToken(tok.token_id);
    return ok({ ok: true, revoked: true });
  } catch (e) {
    return fromApiError(e);
  }
}
