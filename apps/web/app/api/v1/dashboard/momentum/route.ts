import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as dashboardQ from '@compass/db/queries/dashboard';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const days = Number(url.searchParams.get('days') ?? 7);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const items = await dashboardQ.momentumStrip(days, limit);
    return ok({ items });
  } catch (e) {
    return fromApiError(e);
  }
}
