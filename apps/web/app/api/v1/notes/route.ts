import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as notesQ from '@compass/db/queries/notes';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const filedParam = url.searchParams.get('filed');
    const entityTypeParam = url.searchParams.get('entity_type');
    const notes = await notesQ.listAllNotes({
      filed: filedParam === 'unfiled' || filedParam === 'filed' ? filedParam : undefined,
      entity_type:
        entityTypeParam === 'project' || entityTypeParam === 'learning_goal'
          ? entityTypeParam
          : undefined,
      entity_id: url.searchParams.get('entity_id') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 200),
    });
    return ok({ notes });
  } catch (e) {
    return fromApiError(e);
  }
}
