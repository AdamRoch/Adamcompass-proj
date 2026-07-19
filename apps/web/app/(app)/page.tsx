import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { StagePill } from '@/components/ui/stage-pill';
import { StallBadge } from '@/components/ui/stall-badge';
import { cn } from '@/lib/cn';
import * as buildRunsQ from '@compass/db/queries/build_runs';
import * as dashboardQ from '@compass/db/queries/dashboard';
import * as projectsQ from '@compass/db/queries/projects';
import * as settingsQ from '@compass/db/queries/settings';
import { daysAgoIso, humanRelative } from '@compass/shared';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Folder,
  Inbox,
  Plus,
  Target,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';

export const dynamic = 'force-dynamic';

const PROJECT_STAGES = ['idea', 'prd', 'building', 'review', 'shipped', 'archived'] as const;
const LEARNING_STATUSES = ['curious', 'in_progress', 'completed', 'parked', 'archived'] as const;

function GreetingHeader({ tz }: { tz: string }) {
  // All dates rendered server-side; choose a stable formatter.
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(now),
  );
  let greeting = 'Hello';
  if (hour < 5) greeting = 'Up late';
  else if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else if (hour < 22) greeting = 'Good evening';
  else greeting = 'Good night';

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  }).format(now);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
        {greeting}.
      </h1>
      <p className="mt-1 text-sm text-text-muted">{dateLabel}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 text-text-muted" aria-hidden />
      <span className="font-semibold tabular-nums text-text-primary">{value}</span>
      <span className="text-text-muted">{label}</span>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          'rounded-sm px-1 -mx-1 py-0.5',
          'hover:bg-surface-elevated/60 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className="px-1 py-0.5">{body}</div>;
}

function PanelHeader({
  title,
  count,
  seeAllHref,
}: {
  title: string;
  count?: number;
  seeAllHref?: string;
}) {
  return (
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2">
        <CardTitle>{title}</CardTitle>
        {typeof count === 'number' && count > 0 ? (
          <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-surface-elevated px-1 text-2xs font-semibold text-text-muted">
            {count}
          </span>
        ) : null}
      </div>
      {seeAllHref ? (
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          See all
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      ) : null}
    </CardHeader>
  );
}

export default async function DashboardPage() {
  // Pull everything in parallel — these are independent reads.
  const [momentum, attention, week, counts, settings, overnightRuns] = await Promise.all([
    dashboardQ.momentumStrip(7, 6).catch(() => []),
    dashboardQ.needsAttention().catch(() => []),
    dashboardQ.thisWeek(7).catch(() => ({ projects: [], learning_goals: [] })),
    dashboardQ.counts().catch(() => ({
      projects_by_stage: {},
      learning_by_status: {},
      reading_by_status: {},
      inbox_count: 0,
    })),
    settingsQ.getSettings().catch(() => null),
    // "Overnight" = terminal runs in the last 24h — covers the queue-before-bed flow
    // without needing per-user last-seen tracking.
    buildRunsQ
      .recentTerminal(daysAgoIso(1), 8)
      .catch(() => []),
  ]);

  const runProjects = new Map<string, string>();
  for (const r of overnightRuns) {
    if (!runProjects.has(r.project_id)) {
      const p = await projectsQ.getProject(r.project_id).catch(() => null);
      runProjects.set(r.project_id, p?.title ?? 'Unknown project');
    }
  }

  const tz = settings?.timezone ?? 'America/Chicago';

  const projectStageCounts: Record<string, number> = counts.projects_by_stage ?? {};
  const learningStatusCounts: Record<string, number> = counts.learning_by_status ?? {};
  const projectsTotal = PROJECT_STAGES.filter((s) => s !== 'archived').reduce(
    (acc, s) => acc + (projectStageCounts[s] ?? 0),
    0,
  );
  const goalsTotal = LEARNING_STATUSES.filter((s) => s !== 'archived').reduce(
    (acc, s) => acc + (learningStatusCounts[s] ?? 0),
    0,
  );

  const thisWeekItems: Array<{
    type: 'project' | 'learning_goal';
    id: string;
    title: string;
    target_date: string | null;
  }> = [
    ...week.projects.map((p: { id: string; title: string; target_date: string | null }) => ({
      type: 'project' as const,
      id: p.id,
      title: p.title,
      target_date: p.target_date,
    })),
    ...week.learning_goals.map((g: { id: string; title: string; target_date: string | null }) => ({
      type: 'learning_goal' as const,
      id: g.id,
      title: g.title,
      target_date: g.target_date,
    })),
  ].sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));

  return (
    <div className="space-y-6">
      <GreetingHeader tz={tz} />

      {/* Counts row */}
      <Card variant="glass" padding="sm" className="anim-rise">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Stat icon={Folder} label="projects" value={projectsTotal} href="/projects" />
          <span className="text-text-faint">·</span>
          <Stat icon={Target} label="goals" value={goalsTotal} href="/learning" />
          <span className="text-text-faint">·</span>
          <Stat icon={Inbox} label="unfiled" value={counts.inbox_count} href="/inbox" />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
            >
              <Plus className="size-3" aria-hidden />
              Add to Inbox
            </Link>
          </div>
        </div>
      </Card>

      {/* Overnight run summary — only when an agent reported terminal runs in the last 24h */}
      {overnightRuns.length > 0 ? (
        <Card variant="glass" padding="md" className="anim-rise anim-d1">
          <PanelHeader title="Overnight runs" count={overnightRuns.length} />
          <div className="flex flex-col divide-y divide-border/40">
            {overnightRuns.map((r) => {
              const links: Array<{ kind: string; url: string; label?: string }> = JSON.parse(
                r.links_json ?? '[]',
              );
              return (
                <div key={r.id} className="flex items-start gap-3 py-2 text-sm">
                  <span
                    className={cn(
                      'mt-0.5 inline-flex items-center rounded-sm px-1.5 py-0.5 text-2xs font-semibold uppercase',
                      r.status === 'completed'
                        ? 'bg-success/15 text-success'
                        : 'bg-danger/15 text-danger',
                    )}
                  >
                    {r.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/projects/${r.project_id}`}
                      className="font-medium text-text-primary hover:underline"
                    >
                      {runProjects.get(r.project_id)}
                    </Link>
                    <span className="text-text-muted"> — {r.objective ?? 'Build run'}</span>
                    {links.length > 0 ? (
                      <span className="ml-2 inline-flex flex-wrap gap-1.5">
                        {links.map((l) => (
                          <a
                            key={l.url}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-2xs text-accent hover:underline"
                          >
                            {l.label ?? l.kind}
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs tabular-nums text-text-muted">
                    {r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s · ` : ''}
                    {r.ended_at ? humanRelative(r.ended_at, new Date(), tz) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Momentum strip */}
      <Card variant="glass" padding="md" className="anim-rise anim-d2">
        <PanelHeader title="Momentum · last 7 days" seeAllHref="/projects" />
        {momentum.length === 0 ? (
          <EmptyState
            icon={<Zap />}
            title="Nothing touched this week"
            description="Recent project + learning activity will appear here."
          />
        ) : (
          <div className="flex flex-col">
            {momentum.map((item) => {
              const href =
                item.entity_type === 'project' ? `/projects/${item.id}` : `/learning/${item.id}`;
              const isProject = item.entity_type === 'project';
              return (
                <ListItem
                  key={`${item.entity_type}-${item.id}`}
                  dense
                  href={href}
                  icon={
                    isProject ? <Folder className="size-3.5" /> : <Target className="size-3.5" />
                  }
                  title={item.title}
                  meta={`touched ${humanRelative(item.last_touched_at, new Date(), tz)}`}
                  badges={
                    isProject ? (
                      <StagePill
                        stage={item.stage_or_status as Parameters<typeof StagePill>[0]['stage']}
                      />
                    ) : (
                      <span className="text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                        {item.stage_or_status.replace('_', ' ')}
                      </span>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Needs attention */}
        <Card variant="glass" padding="md" className="anim-rise anim-d3">
          <PanelHeader title="Needs attention" count={attention.length} seeAllHref="/projects" />
          {attention.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle />}
              title="Nothing stalled"
              description="All projects + goals are within their stall thresholds."
            />
          ) : (
            <div className="flex flex-col">
              {attention.slice(0, 8).map((item) => {
                const href =
                  item.entity_type === 'project' ? `/projects/${item.id}` : `/learning/${item.id}`;
                const isProject = item.entity_type === 'project';
                return (
                  <ListItem
                    key={`${item.entity_type}-${item.id}`}
                    dense
                    href={href}
                    icon={
                      isProject ? <Folder className="size-3.5" /> : <Target className="size-3.5" />
                    }
                    title={item.title}
                    meta={`last touched ${humanRelative(item.last_touched_at, new Date(), tz)}`}
                    badges={<StallBadge days={item.days_since_touch} />}
                  />
                );
              })}
            </div>
          )}
        </Card>

        {/* This week */}
        <Card variant="glass" padding="md" className="anim-rise anim-d4">
          <PanelHeader title="This week" count={thisWeekItems.length} />
          {thisWeekItems.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="Nothing on deck"
              description="Items with a target date in the next 7 days will appear here."
            />
          ) : (
            <div className="flex flex-col">
              {thisWeekItems.slice(0, 8).map((item) => {
                const href =
                  item.type === 'project' ? `/projects/${item.id}` : `/learning/${item.id}`;
                const isProject = item.type === 'project';
                const dateLabel = item.target_date
                  ? new Intl.DateTimeFormat(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    }).format(new Date(`${item.target_date}T00:00:00Z`))
                  : '—';
                return (
                  <ListItem
                    key={`${item.type}-${item.id}`}
                    dense
                    href={href}
                    icon={
                      isProject ? <Folder className="size-3.5" /> : <Target className="size-3.5" />
                    }
                    title={item.title}
                    badges={
                      <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5 text-2xs font-semibold text-accent">
                        <CalendarClock className="size-3" aria-hidden />
                        {dateLabel}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Activity placeholder + quick capture hint */}
      <Card variant="glass" padding="md" className="anim-rise anim-d5">
        <PanelHeader title="Quick capture" />
        <div className="flex items-center justify-between gap-3 text-sm text-text-muted">
          <p>
            Hit <kbd className="rounded-sm border bg-surface px-1 font-mono text-2xs">⌘N</kbd> from
            anywhere to capture an idea, note, or curiosity. Everything lands in your Inbox.
          </p>
          <Link href="/inbox">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-3" />}>
              Open Inbox
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
