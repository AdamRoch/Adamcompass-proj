import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as learningQ from '@compass/db/queries/learning';
import { ApiError } from '@compass/shared';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const learning_goal = await learningQ.unsnoozeLearningGoal(id);
    if (!learning_goal) throw new ApiError('not_found', 'learning goal not found', 404);
    return ok({ learning_goal });
  } catch (e) {
    return fromApiError(e);
  }
}
