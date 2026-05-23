import type { NextRequest } from 'next/server';
import { renderDigest } from '@compass/scheduler';
import * as settingsQ from '@compass/db/queries/settings';
import { fromApiError, ok, requireAuth } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const settings = await settingsQ.getSettings();
    const markdown = await renderDigest({ tz: settings.timezone });
    return ok({ markdown });
  } catch (e) {
    return fromApiError(e);
  }
}
