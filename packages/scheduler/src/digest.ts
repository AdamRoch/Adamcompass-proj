import { dashboard as dashboardQ } from '@compass/db/queries';
import { escapeMarkdownV2, escapeMarkdownV2Url } from '@compass/notifications';
import { humanRelative } from '@compass/shared';

const STALL_CAP = 20;

function entityUrl(
  entity_type: 'project' | 'learning_goal',
  id: string,
  baseUrl: string,
): string {
  const segment = entity_type === 'project' ? 'projects' : 'learning';
  return `${baseUrl}/${segment}/${id}`;
}

function mdLink(label: string, url: string): string {
  return `[${escapeMarkdownV2(label)}](${escapeMarkdownV2Url(url)})`;
}

export async function renderDigest(opts?: { tz?: string; baseUrl?: string }): Promise<string> {
  const tz = opts?.tz ?? 'America/Chicago';
  const baseUrl = (opts?.baseUrl ?? process.env.COMPASS_BASE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const [momentum, stalls, week, counts] = await Promise.all([
    dashboardQ.momentumStrip(7, 10),
    dashboardQ.needsAttention(),
    dashboardQ.thisWeek(7),
    dashboardQ.counts(),
  ]);
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const parts: string[] = [];
  parts.push(`Compass — ${escapeMarkdownV2(date)}`);
  parts.push('');

  parts.push('*Momentum \\(last 7 days\\)*');
  if (momentum.length === 0) {
    parts.push('_Nothing touched this week\\._');
  } else {
    for (const m of momentum.slice(0, 6)) {
      const tag = m.entity_type === 'project' ? '\u{1F4E6}' : '\u{1F4DA}';
      const link = entityUrl(m.entity_type, m.id, baseUrl);
      const rel = escapeMarkdownV2(humanRelative(m.last_touched_at, now, tz));
      const stage = escapeMarkdownV2(m.stage_or_status);
      parts.push(`${tag} ${mdLink(m.title, link)} — ${rel}, ${stage}`);
    }
  }
  parts.push('');

  parts.push('*Needs attention*');
  if (stalls.length === 0) {
    parts.push('_All current\\._');
  } else {
    if (stalls.length > STALL_CAP) {
      console.warn(
        `[digest] ${stalls.length} stalled items found; truncating to ${STALL_CAP} for digest`,
      );
    }
    for (const s of stalls.slice(0, STALL_CAP)) {
      const tag = s.entity_type === 'project' ? '\u{1F4E6}' : '\u{1F4DA}';
      const link = entityUrl(s.entity_type, s.id, baseUrl);
      parts.push(`${tag} ${mdLink(s.title, link)} — ${s.days_since_touch}d stalled`);
    }
    if (stalls.length > STALL_CAP) {
      parts.push(`_…and ${stalls.length - STALL_CAP} more\\._`);
    }
  }
  parts.push('');

  parts.push('*This week*');
  const wkItems: string[] = [];
  for (const p of week.projects)
    wkItems.push(
      `\u{1F4E6} ${mdLink(p.title, `${baseUrl}/projects/${p.id}`)} — ${escapeMarkdownV2(p.target_date ?? '')}`,
    );
  for (const g of week.learning_goals)
    wkItems.push(
      `\u{1F4DA} ${mdLink(g.title, `${baseUrl}/learning/${g.id}`)} — ${escapeMarkdownV2(g.target_date ?? '')}`,
    );
  parts.push(wkItems.length === 0 ? '_No targets this week\\._' : wkItems.join('\n'));

  parts.push('');
  const inbox = counts.inbox_count;
  const projTotal = Object.values(counts.projects_by_stage).reduce((a, b) => a + b, 0);
  const learnTotal = Object.values(counts.learning_by_status).reduce((a, b) => a + b, 0);
  parts.push(`_${inbox} in inbox · ${projTotal} projects · ${learnTotal} learning goals_`);

  return parts.join('\n');
}
