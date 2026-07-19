import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import * as milestonesQ from '@compass/db/queries/milestones';
import * as projectsQ from '@compass/db/queries/projects';
import { ApiError } from '@compass/shared';
import { createMilestoneSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const milestones = await milestonesQ.listForProject(id);
    return ok({ milestones });
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
    const body = await readJson(req, createMilestoneSchema);
    const milestone = await milestonesQ.add({ project_id: id, title: body.title });
    return ok({ milestone }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
