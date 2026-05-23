import type { NextRequest } from 'next/server';
import * as dashboardQ from '@compass/db/queries/dashboard';
import { fromApiError, ok, requireAuth } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const days = Number(url.searchParams.get('days') ?? 7);
    const result = await dashboardQ.thisWeek(days);
    return ok(result);
  } catch (e) {
    return fromApiError(e);
  }
}
