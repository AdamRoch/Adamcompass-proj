import type { NextRequest } from 'next/server';
import * as webhookQ from '@compass/db/queries/webhook';
import { fromApiError, ok, requireAuth } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 200));
    const deliveries = await webhookQ.listRecent(limit);
    return ok({ deliveries });
  } catch (e) {
    return fromApiError(e);
  }
}
