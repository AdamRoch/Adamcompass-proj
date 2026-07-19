import { dashboard as dashboardQ, stall as stallQ } from '@compass/db/queries';
import { escapeMarkdownV2, notify } from '@compass/notifications';

/**
 * Sweep stalled entities and fire alerts per the dedupe rules.
 * Called by the scheduler every 15 minutes (default).
 */
export async function sweepStalls(now = new Date().toISOString()) {
  const stalled = await dashboardQ.needsAttention();
  for (const s of stalled) {
    const decision = await stallQ.shouldFireStall(s.entity_type, s.id, s.last_touched_at, now);
    if (decision === 'skip') continue;

    const verb = decision === 'reminder' ? 'Still stalled' : 'Stalled';
    const tag = s.entity_type === 'project' ? '\u{1F4E6}' : '\u{1F4DA}';
    // Subject is plain text (the Telegram provider escapes it). The body is MarkdownV2 with
    // explicitly-escaped interpolations so an entity title containing `*` or `_` doesn't break
    // parsing.
    const safeTitle = escapeMarkdownV2(s.title);
    const safeType = escapeMarkdownV2(s.entity_type.replace('_', ' '));
    await notify({
      kind: 'stall_alert',
      subject: `${verb}: ${s.title}`,
      body_markdown:
        `${tag} *${safeTitle}* \\(${safeType}\\)\n` +
        `Last touched ${s.days_since_touch}d ago, threshold ${s.threshold_days}d\\.`,
      ref: { entity_type: s.entity_type, entity_id: s.id },
    });
    await stallQ.markAlerted(s.entity_type, s.id, now);
  }
}
