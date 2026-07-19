import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as dashboardQ from '@compass/db/queries/dashboard';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const items = await dashboardQ.needsAttention();
    return ok({ items });
  } catch (e) {
    return fromApiError(e);
  }
}
