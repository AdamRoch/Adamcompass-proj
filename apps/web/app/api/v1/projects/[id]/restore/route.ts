import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as projectsQ from '@compass/db/queries/projects';
import { ApiError } from '@compass/shared';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const project = await projectsQ.restoreProject(id);
    if (!project) throw new ApiError('not_found', 'project not found', 404);
    return ok({ project });
  } catch (e) {
    return fromApiError(e);
  }
}
