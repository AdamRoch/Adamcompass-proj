import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { indexResource } from '@/lib/index-entity';
import * as resourcesQ from '@compass/db/queries/resources';
import type { ReadingStatus, ResourceKind } from '@compass/shared';
import { createResourceSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as ReadingStatus | null;
    const kind = url.searchParams.get('kind') as ResourceKind | null;
    const learning_goal_id = url.searchParams.get('learning_goal_id');
    const limit = Number(url.searchParams.get('limit') ?? 200);
    const resources = await resourcesQ.list({
      status: status ?? undefined,
      kind: kind ?? undefined,
      learning_goal_id: learning_goal_id ?? undefined,
      limit,
    });
    return ok({ resources });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await readJson(req, createResourceSchema);
    const resource = await resourcesQ.create(body);
    await indexResource(resource.id);
    return ok({ resource }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
