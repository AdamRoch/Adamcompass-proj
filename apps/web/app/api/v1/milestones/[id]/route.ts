import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import * as milestonesQ from '@compass/db/queries/milestones';
import { ApiError } from '@compass/shared';
import { updateMilestoneSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, updateMilestoneSchema);
    let milestone = await milestonesQ.getMilestone(id);
    if (!milestone) throw new ApiError('not_found', 'milestone not found', 404);
    if (body.title !== undefined) {
      milestone = await milestonesQ.rename(id, body.title);
    }
    if (body.done !== undefined && milestone && milestone.done !== body.done) {
      milestone = await milestonesQ.toggleDone(id);
    }
    return ok({ milestone });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const removed = await milestonesQ.remove(id);
    if (!removed) throw new ApiError('not_found', 'milestone not found', 404);
    return ok({ removed: true });
  } catch (e) {
    return fromApiError(e);
  }
}
