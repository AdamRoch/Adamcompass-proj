import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as activityQ from '@compass/db/queries/activity';
import { ENTITY_TYPES, type EntityType } from '@compass/shared';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const typesParam = url.searchParams.get('types');
    const types = typesParam
      ? (typesParam
          .split(',')
          .filter((t) => (ENTITY_TYPES as readonly string[]).includes(t)) as EntityType[])
      : undefined;
    const page = await activityQ.recentPaged({
      cursor: url.searchParams.get('cursor'),
      types,
      limit: Number(url.searchParams.get('limit') ?? 50),
    });
    return ok(page);
  } catch (e) {
    return fromApiError(e);
  }
}
