import { PromoteCuriosityButton } from '@/components/promote-curiosity-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SnoozeBadge } from '@/components/ui/snooze-badge';
import { StallBadge } from '@/components/ui/stall-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagChip } from '@/components/ui/tag-chip';
import { cn } from '@/lib/cn';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as settingsQ from '@compass/db/queries/settings';
import * as tagsQ from '@compass/db/queries/tags';
import { type LearningStatus, humanRelative } from '@compass/shared';
import { BookOpen, Target } from 'lucide-react';
import Link from 'next/link';
import { NewGoalDialog } from './new-goal-dialog';

export const dynamic = 'force-dynamic';

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'curious', label: 'Curious' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'parked', label: 'Parked' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_STYLES: Record<LearningStatus, string> = {
  curious: 'bg-text-muted/15 text-text-muted',
  in_progress: 'bg-accent-soft text-accent',
  completed: 'bg-success/15 text-success',
  parked: 'bg-warning/15 text-warning',
  archived: 'bg-text-faint/15 text-text-faint',
};

const STATUS_LABELS: Record<LearningStatus, string> = {
  curious: 'CURIOUS',
  in_progress: 'IN PROGRESS',
  completed: 'COMPLETED',
  parked: 'PARKED',
  archived: 'ARCHIVED',
};

function daysBetween(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function StatusPill({ status }: { status: LearningStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center px-1.5 rounded-sm',
        'text-2xs font-semibold uppercase tracking-[0.05em]',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface SearchParams {
  status?: string;
  snoozed?: string;
  tag?: string;
}

export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const statusParam = (params.status ?? 'all').toLowerCase();
  const snoozedParam = (params.snoozed ?? 'show').toLowerCase();
  const tagParam = params.tag ?? null;

  const includeArchived = statusParam === 'archived' || statusParam === 'all';
  const statusFilter =
    statusParam !== 'all' && statusParam !== 'archived'
      ? (statusParam as LearningStatus)
      : undefined;

  const [goalsRaw, settings, inboxNotes] = await Promise.all([
    learningQ
      .listLearningGoals({ status: statusFilter, includeArchived, limit: 500 })
      .catch(() => []),
    settingsQ.getSettings().catch(() => null),
    notesQ.listInbox(100).catch(() => []),
  ]);
  const curiosities = inboxNotes.filter((n) => n.inbox_type_hint === 'curiosity');

  let goals = goalsRaw;
  if (statusParam === 'archived') {
    goals = goals.filter((g) => g.status === 'archived');
  }

  const tz = settings?.timezone ?? 'America/Chicago';
  const defaultStall = settings?.default_stall_threshold_learning_days ?? 2;
  const nowIso = new Date().toISOString();

  const goalsWithTags = await Promise.all(
    goals.map(async (g) => {
      const tags = await tagsQ.tagsForEntity('learning_goal', g.id).catch(() => []);
      return { goal: g, tags };
    }),
  );

  let filtered = goalsWithTags;
  if (snoozedParam === 'hidden') {
    filtered = filtered.filter(({ goal }) => {
      const s = goal.snoozed_until;
      if (!s) return true;
      return s < nowIso;
    });
  }
  if (tagParam) {
    const tagLower = tagParam.toLowerCase();
    filtered = filtered.filter(({ tags }) =>
      tags.some((t: { name: string }) => t.name.toLowerCase() === tagLower),
    );
  }

  const allTags = Array.from(
    new Set(goalsWithTags.flatMap(({ tags }) => tags.map((t: { name: string }) => t.name))),
  ).sort();

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Learning
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            <span className="font-semibold tabular-nums text-text-primary">{filtered.length}</span>{' '}
            of {goalsWithTags.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/learning/reading">
            <Button variant="secondary" leftIcon={<BookOpen className="size-4" />}>
              Reading list
            </Button>
          </Link>
          <NewGoalDialog />
        </div>
      </header>

      {/* Curiosity rail — unfiled curiosity captures waiting to become goals (PRD V2 §3.5) */}
      {curiosities.length > 0 ? (
        <Card variant="glass" padding="md">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Curiosities</h2>
            <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-surface-elevated px-1 text-2xs font-semibold text-text-muted">
              {curiosities.length}
            </span>
            <span className="text-2xs text-text-muted">
              captured with “curious about…” — promote the keepers
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border/40">
            {curiosities.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {c.title || c.body_markdown.split('\n')[0]}
                </p>
                <span className="shrink-0 text-2xs text-text-muted">
                  {humanRelative(c.created_at, new Date(), tz)}
                </span>
                <PromoteCuriosityButton noteId={c.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Tabs value={statusParam}>
        <TabsList className="flex flex-wrap">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s.value} value={s.value} asChild>
              <Link
                href={{
                  pathname: '/learning',
                  query: {
                    ...(s.value !== 'all' ? { status: s.value } : {}),
                    ...(snoozedParam !== 'show' ? { snoozed: snoozedParam } : {}),
                    ...(tagParam ? { tag: tagParam } : {}),
                  },
                }}
              >
                {s.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-text-muted">Snoozed:</span>
        <Link
          href={{
            pathname: '/learning',
            query: {
              ...(statusParam !== 'all' ? { status: statusParam } : {}),
              ...(tagParam ? { tag: tagParam } : {}),
            },
          }}
          className={
            snoozedParam === 'show'
              ? 'rounded-sm bg-accent-soft px-2 py-0.5 text-accent'
              : 'rounded-sm px-2 py-0.5 text-text-muted hover:text-text-primary'
          }
        >
          Show
        </Link>
        <Link
          href={{
            pathname: '/learning',
            query: {
              ...(statusParam !== 'all' ? { status: statusParam } : {}),
              ...(tagParam ? { tag: tagParam } : {}),
              snoozed: 'hidden',
            },
          }}
          className={
            snoozedParam === 'hidden'
              ? 'rounded-sm bg-accent-soft px-2 py-0.5 text-accent'
              : 'rounded-sm px-2 py-0.5 text-text-muted hover:text-text-primary'
          }
        >
          Hide
        </Link>
        {allTags.length > 0 ? (
          <>
            <span className="ml-3 text-text-muted">Tag:</span>
            {tagParam ? (
              <Link
                href={{
                  pathname: '/learning',
                  query: {
                    ...(statusParam !== 'all' ? { status: statusParam } : {}),
                    ...(snoozedParam !== 'show' ? { snoozed: snoozedParam } : {}),
                  },
                }}
                className="rounded-sm bg-accent-soft px-2 py-0.5 text-accent"
              >
                #{tagParam} ×
              </Link>
            ) : (
              allTags.slice(0, 10).map((t) => (
                <Link
                  key={t}
                  href={{
                    pathname: '/learning',
                    query: {
                      ...(statusParam !== 'all' ? { status: statusParam } : {}),
                      ...(snoozedParam !== 'show' ? { snoozed: snoozedParam } : {}),
                      tag: t,
                    },
                  }}
                  className="rounded-sm px-2 py-0.5 text-text-muted hover:text-text-primary"
                >
                  #{t}
                </Link>
              ))
            )}
          </>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card variant="glass" padding="lg">
          <EmptyState
            icon={<Target />}
            title={goalsWithTags.length === 0 ? 'No learning goals yet' : 'No goals match'}
            description={
              goalsWithTags.length === 0
                ? 'Create your first learning goal to start tracking your curiosity.'
                : 'Try a different status or clear the filters.'
            }
            action={goalsWithTags.length === 0 ? <NewGoalDialog /> : undefined}
          />
        </Card>
      ) : (
        <Card variant="glass" padding="none">
          <div className="flex flex-col divide-y divide-border/40">
            {filtered.map(({ goal, tags }) => {
              const days = daysBetween(goal.last_touched_at, nowIso);
              const threshold = goal.stall_threshold_days ?? defaultStall;
              const isSnoozed = !!goal.snoozed_until && goal.snoozed_until > nowIso;
              const isStalled =
                !isSnoozed &&
                days >= threshold &&
                (goal.status === 'curious' || goal.status === 'in_progress');
              return (
                <ListItem
                  key={goal.id}
                  dense
                  href={`/learning/${goal.id}`}
                  icon={<Target className="size-3.5" />}
                  title={goal.title}
                  meta={`touched ${humanRelative(goal.last_touched_at, new Date(), tz)}`}
                  snoozed={isSnoozed}
                  badges={
                    <>
                      <StatusPill status={goal.status} />
                      {isStalled ? <StallBadge days={days} /> : null}
                      {isSnoozed && goal.snoozed_until ? (
                        <SnoozeBadge
                          until={goal.snoozed_until}
                          reason={goal.snooze_reason ?? undefined}
                        />
                      ) : null}
                      {tags.slice(0, 3).map((t: { id: string; name: string }) => (
                        <TagChip key={t.id} name={t.name} />
                      ))}
                    </>
                  }
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
