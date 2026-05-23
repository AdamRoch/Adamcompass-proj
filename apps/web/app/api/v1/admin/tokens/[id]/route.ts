import type { NextRequest } from 'next/server';
import * as authQ from '@compass/db/queries/auth';
import * as adminQ from '@compass/db/queries/admin';
import { ApiError } from '@compass/shared';
import { fromApiError, ok, requireAuth } from '@/lib/api';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    if (auth.principal !== 'user') {
      throw new ApiError('forbidden', 'revoking tokens requires a user session', 403);
    }
    const { id } = await params;
    await authQ.revokeToken(id);
    await adminQ.writeAudit({
      actor: 'user',
      action: 'token.revoke',
      metadata: { token_id: id },
    });
    return ok({ revoked: true });
  } catch (e) {
    return fromApiError(e);
  }
}
