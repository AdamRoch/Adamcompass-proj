import type { NextRequest } from 'next/server';
import * as adminQ from '@compass/db/queries/admin';
import { fromApiError, ok, requireAuth } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 200));
    const events = await adminQ.listAudit(limit);
    return ok({ events });
  } catch (e) {
    return fromApiError(e);
  }
}
