import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import * as learningQ from '@compass/db/queries/learning';
import { ApiError } from '@compass/shared';
import { archiveSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, archiveSchema).catch(() => ({ reason: undefined }));
    const goal = await learningQ.archiveLearningGoal(id, body.reason);
    if (!goal) throw new ApiError('not_found', 'learning goal not found', 404);
    return ok({ goal });
  } catch (e) {
    return fromApiError(e);
  }
}
