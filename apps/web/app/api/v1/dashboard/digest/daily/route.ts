import { fromApiError, ok, requireAuth } from '@/lib/api';
import * as settingsQ from '@compass/db/queries/settings';
import { renderDigest } from '@compass/scheduler';
import type { NextRequest } from 'next/server';

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
