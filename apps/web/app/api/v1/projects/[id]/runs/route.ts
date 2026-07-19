import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import * as buildRunsQ from '@compass/db/queries/build_runs';
import * as projectsQ from '@compass/db/queries/projects';
import { ApiError } from '@compass/shared';
import { queueRunSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const runs = await buildRunsQ.listForProject(id);
    return ok({ runs });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const project = await projectsQ.getProject(id);
    if (!project) throw new ApiError('not_found', 'project not found', 404);
    const body = await readJson(req, queueRunSchema);
    const run = await buildRunsQ.queueRun(id, body.objective);
    return ok({ run }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
