import type { NextRequest } from 'next/server';
import * as projectsQ from '@compass/db/queries/projects';
import * as stallQ from '@compass/db/queries/stall';
import { snoozeSchema } from '@compass/shared/zod';
import { ApiError } from '@compass/shared';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, snoozeSchema);
    const project = await projectsQ.snoozeProject(id, body.until, body.reason);
    if (!project) throw new ApiError('not_found', 'project not found', 404);
    await stallQ.clearStallState('project', id);
    return ok({ project });
  } catch (e) {
    return fromApiError(e);
  }
}
