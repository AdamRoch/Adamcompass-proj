import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import * as settingsQ from '@compass/db/queries/settings';
import { settingsPatchSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

// Fields whose values are baked into scheduler cron expressions. When any of these change we
// need to re-register jobs so the new wall-clock times take effect.
const SCHEDULER_RELEVANT_FIELDS = [
  'timezone',
  'digest_send_time',
  'quiet_hours_start',
  'quiet_hours_end',
] as const;

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const settings = await settingsQ.getSettings();
    return ok({ settings });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await readJson(req, settingsPatchSchema);
    const settings = await settingsQ.patchSettings(body);
    // Restart scheduler if any cron-affecting field was touched, so the running process
    // picks up the new digest_send_time / quiet_hours_end / timezone without a redeploy.
    const touched = SCHEDULER_RELEVANT_FIELDS.some((k) =>
      Object.prototype.hasOwnProperty.call(body, k),
    );
    if (touched) {
      try {
        const { restartScheduler } = await import('@compass/scheduler');
        await restartScheduler();
      } catch (err) {
        console.error('[settings] scheduler restart failed', err);
      }
    }
    return ok({ settings });
  } catch (e) {
    return fromApiError(e);
  }
}
