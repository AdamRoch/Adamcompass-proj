import type { NextRequest } from 'next/server';
import * as learningQ from '@compass/db/queries/learning';
import * as stallQ from '@compass/db/queries/stall';
import { snoozeSchema } from '@compass/shared/zod';
import { ApiError } from '@compass/shared';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, snoozeSchema);
    const learning_goal = await learningQ.snoozeLearningGoal(id, body.until, body.reason);
    if (!learning_goal) throw new ApiError('not_found', 'learning goal not found', 404);
    await stallQ.clearStallState('learning_goal', id);
    return ok({ learning_goal });
  } catch (e) {
    return fromApiError(e);
  }
}
