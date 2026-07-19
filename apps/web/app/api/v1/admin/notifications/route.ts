import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as notifQ from '@compass/db/queries/notifications';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 200));
    const notifications = await notifQ.listRecent(limit);
    return ok({ notifications });
  } catch (e) {
    return fromApiError(e);
  }
}
