import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as dashboardQ from '@compass/db/queries/dashboard';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const c = await dashboardQ.counts();
    return ok(c);
  } catch (e) {
    return fromApiError(e);
  }
}
