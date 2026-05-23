import type { NextRequest } from 'next/server';
import * as learningQ from '@compass/db/queries/learning';
import { createLearningGoalSchema } from '@compass/shared/zod';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { indexLearningGoal } from '@/lib/index-entity';
import type { LearningStatus } from '@compass/shared';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as LearningStatus | null;
    const includeArchived = url.searchParams.get('include_archived') === 'true';
    const limit = Number(url.searchParams.get('limit') ?? 200);
    const learning_goals = await learningQ.listLearningGoals({
      status: status ?? undefined,
      includeArchived,
      limit,
    });
    return ok({ learning_goals });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await readJson(req, createLearningGoalSchema);
    const learning_goal = await learningQ.createLearningGoal(body);
    await indexLearningGoal(learning_goal.id);
    return ok({ learning_goal }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
