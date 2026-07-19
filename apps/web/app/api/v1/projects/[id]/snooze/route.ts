import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import * as projectsQ from '@compass/db/queries/projects';
import * as stallQ from '@compass/db/queries/stall';
import { ApiError } from '@compass/shared';
import { snoozeSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

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
