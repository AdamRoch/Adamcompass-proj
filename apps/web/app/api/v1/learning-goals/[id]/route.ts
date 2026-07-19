import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { indexLearningGoal } from '@/lib/index-entity';
import * as activityQ from '@compass/db/queries/activity';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as resourcesQ from '@compass/db/queries/resources';
import * as tagsQ from '@compass/db/queries/tags';
import { ApiError } from '@compass/shared';
import { updateLearningGoalSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const learning_goal = await learningQ.getLearningGoal(id);
    if (!learning_goal) throw new ApiError('not_found', 'learning goal not found', 404);
    const [notes, resources, activity_events, tags] = await Promise.all([
      notesQ.listNotesForEntity('learning_goal', id),
      resourcesQ.list({ learning_goal_id: id }),
      activityQ.listForEntity('learning_goal', id, 50),
      tagsQ.tagsForEntity('learning_goal', id),
    ]);
    return ok({ learning_goal, notes, resources, activity_events, tags });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, updateLearningGoalSchema);
    const updated = await learningQ.updateLearningGoal(id, body as never);
    if (!updated) throw new ApiError('not_found', 'learning goal not found', 404);
    await indexLearningGoal(id);
    return ok({ learning_goal: updated });
  } catch (e) {
    return fromApiError(e);
  }
}
