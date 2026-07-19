import { settings as settingsQ } from '@compass/db/queries';
import { drainPending, notify } from '@compass/notifications';
import { isInQuietHours } from '@compass/shared';
import cron from 'node-cron';
import { renderDigest } from './digest.js';
import { sweepStalls } from './stall.js';

let started = false;
const tasks: cron.ScheduledTask[] = [];

export interface SchedulerOptions {
  timezone?: string;
}

export async function startScheduler(opts?: SchedulerOptions) {
  if (started) return;
  await registerJobs(opts);
  started = true;
}

/**
 * Stop all scheduled tasks, then re-register them from current settings. Called when settings
 * change (e.g. the user updates digest_send_time or quiet_hours_end) so cron expressions reflect
 * the new values without requiring a server restart. See PRD §11.2.
 */
export async function restartScheduler(opts?: SchedulerOptions) {
  stopScheduler();
  await registerJobs(opts);
  started = true;
}

async function registerJobs(opts?: SchedulerOptions) {
  const settings = await settingsQ.getSettings();
  const tz = opts?.timezone ?? settings.timezone;

  // Daily digest at user-configured time
  const [dh, dm] = settings.digest_send_time.split(':').map(Number);
  const digestCron = `${dm ?? 0} ${dh ?? 9} * * *`;
  tasks.push(cron.schedule(digestCron, runDailyDigestJob, { timezone: tz, scheduled: true }));

  // Stall sweeper: every 15 minutes
  tasks.push(cron.schedule('*/15 * * * *', runStallSweepJob, { timezone: tz, scheduled: true }));

  // Quiet-hours drain: fire at user-configured quiet_hours_end (in user TZ). When this tick
  // runs, isInQuietHours() will be false, so drainPending() will flush queued sends.
  const [qh, qm] = settings.quiet_hours_end.split(':').map(Number);
  const drainCron = `${qm ?? 0} ${qh ?? 7} * * *`;
  tasks.push(cron.schedule(drainCron, runDrainPendingJob, { timezone: tz, scheduled: true }));

  console.log(
    `[scheduler] started in tz=${tz}; digest=${digestCron}; stall=*/15; drain=${drainCron}`,
  );
}

export function stopScheduler() {
  for (const t of tasks) t.stop();
  tasks.length = 0;
  started = false;
}

export async function runDailyDigestJob() {
  try {
    const settings = await settingsQ.getSettings();
    if (!settings.notif_digest_enabled) return;
    const body = await renderDigest({ tz: settings.timezone });
    await notify({
      kind: 'daily_digest',
      subject: 'Compass — daily digest',
      body_markdown: body,
    });
  } catch (e) {
    console.error('[scheduler] daily digest failed', e);
  }
}

export async function runStallSweepJob() {
  try {
    await sweepStalls();
  } catch (e) {
    console.error('[scheduler] stall sweep failed', e);
  }
}

export async function runDrainPendingJob() {
  try {
    const settings = await settingsQ.getSettings();
    if (isInQuietHours(settings.quiet_hours_start, settings.quiet_hours_end, settings.timezone))
      return;
    await drainPending();
  } catch (e) {
    console.error('[scheduler] drain failed', e);
  }
}

export { renderDigest, sweepStalls };
