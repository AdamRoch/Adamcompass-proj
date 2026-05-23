import type { NextRequest } from 'next/server';
import * as notesQ from '@compass/db/queries/notes';
import { fromApiError, ok, requireAuth } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 100));
    const notes = await notesQ.listInbox(limit);
    return ok({ notes });
  } catch (e) {
    return fromApiError(e);
  }
}
