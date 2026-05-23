import type { NextRequest } from 'next/server';
import * as resourcesQ from '@compass/db/queries/resources';
import { ApiError } from '@compass/shared';
import { fromApiError, ok, requireAuth } from '@/lib/api';
import { indexResource } from '@/lib/index-entity';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const updated = await resourcesQ.update(id, body as never);
    if (!updated) throw new ApiError('not_found', 'resource not found', 404);
    await indexResource(id);
    return ok({ resource: updated });
  } catch (e) {
    return fromApiError(e);
  }
}
