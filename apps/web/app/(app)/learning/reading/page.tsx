import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import * as learningQ from '@compass/db/queries/learning';
import * as resourcesQ from '@compass/db/queries/resources';
import { RESOURCE_KINDS, type ReadingStatus, type ResourceKind } from '@compass/shared';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { NewResourceDialog } from './new-resource-dialog';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<ReadingStatus, string> = {
  to_read: 'To read',
  reading: 'Reading',
  read: 'Read',
  abandoned: 'Abandoned',
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'to_read', label: 'To read' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
  { value: 'abandoned', label: 'Abandoned' },
];

interface SearchParams {
  status?: string;
  kind?: string;
  goal?: string;
}

export default async function ReadingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const statusParam = (params.status ?? 'all').toLowerCase();
  const kindParam = (params.kind ?? 'all').toLowerCase();
  const goalId = params.goal ?? null;

  const statusFilter: ReadingStatus | undefined =
    statusParam !== 'all' ? (statusParam as ReadingStatus) : undefined;
  const kindFilter: ResourceKind | undefined =
    kindParam !== 'all' ? (kindParam as ResourceKind) : undefined;

  const [resources, goals] = await Promise.all([
    resourcesQ
      .list({
        status: statusFilter,
        kind: kindFilter,
        learning_goal_id: goalId ?? undefined,
        limit: 500,
      })
      .catch(() => []),
    learningQ.listLearningGoals({ limit: 500 }).catch(() => []),
  ]);

  const goalLookup = new Map(goals.map((g) => [g.id, g.title]));
  const goalOpts = goals.map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="space-y-5">
      <Link
        href="/learning"
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3" aria-hidden /> Learning
      </Link>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Reading list
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            <span className="font-semibold tabular-nums text-text-primary">{resources.length}</span>{' '}
            items
          </p>
        </div>
        <NewResourceDialog goals={goalOpts} />
      </header>

      <Tabs value={statusParam}>
        <TabsList className="flex flex-wrap">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s.value} value={s.value} asChild>
              <Link
                href={{
                  pathname: '/learning/reading',
                  query: {
                    ...(s.value !== 'all' ? { status: s.value } : {}),
                    ...(kindParam !== 'all' ? { kind: kindParam } : {}),
                    ...(goalId ? { goal: goalId } : {}),
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
        <span className="text-text-muted">Kind:</span>
        <Link
          href={{
            pathname: '/learning/reading',
            query: {
              ...(statusParam !== 'all' ? { status: statusParam } : {}),
              ...(goalId ? { goal: goalId } : {}),
            },
          }}
          className={
            kindParam === 'all'
              ? 'rounded-sm bg-accent-soft px-2 py-0.5 text-accent'
              : 'rounded-sm px-2 py-0.5 text-text-muted hover:text-text-primary'
          }
        >
          All
        </Link>
        {RESOURCE_KINDS.map((k) => (
          <Link
            key={k}
            href={{
              pathname: '/learning/reading',
              query: {
                ...(statusParam !== 'all' ? { status: statusParam } : {}),
                ...(goalId ? { goal: goalId } : {}),
                kind: k,
              },
            }}
            className={
              kindParam === k
                ? 'rounded-sm bg-accent-soft px-2 py-0.5 text-accent'
                : 'rounded-sm px-2 py-0.5 text-text-muted hover:text-text-primary'
            }
          >
            {k}
          </Link>
        ))}
        {goalId ? (
          <>
            <span className="ml-3 text-text-muted">Goal:</span>
            <Link
              href={{
                pathname: '/learning/reading',
                query: {
                  ...(statusParam !== 'all' ? { status: statusParam } : {}),
                  ...(kindParam !== 'all' ? { kind: kindParam } : {}),
                },
              }}
              className="rounded-sm bg-accent-soft px-2 py-0.5 text-accent"
            >
              {goalLookup.get(goalId) ?? goalId} ×
            </Link>
          </>
        ) : null}
      </div>

      {resources.length === 0 ? (
        <Card variant="glass" padding="lg">
          <EmptyState
            icon={<BookOpen />}
            title="Empty reading list"
            description={
              statusParam !== 'all' || kindParam !== 'all' || goalId
                ? 'No resources match these filters.'
                : 'Articles, books, papers, and videos will live here.'
            }
            action={<NewResourceDialog goals={goalOpts} />}
          />
        </Card>
      ) : (
        <Card variant="glass" padding="none">
          <div className="flex flex-col divide-y divide-border/40">
            {resources.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5',
                  'hover:bg-surface-elevated/60 transition-colors',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">{r.title}</div>
                  {r.author_source ? (
                    <div className="truncate text-xs text-text-muted">{r.author_source}</div>
                  ) : null}
                </div>
                <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-surface-elevated px-1.5 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                  {r.kind}
                </span>
                <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-accent-soft px-1.5 text-2xs font-semibold text-accent">
                  {STATUS_LABEL[r.reading_status]}
                </span>
                {r.learning_goal_id ? (
                  <Link
                    href={`/learning/${r.learning_goal_id}`}
                    className="shrink-0 truncate text-2xs text-text-muted hover:text-text-primary max-w-[140px]"
                  >
                    {goalLookup.get(r.learning_goal_id) ?? '—'}
                  </Link>
                ) : (
                  <span className="shrink-0 text-2xs text-text-faint">—</span>
                )}
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-text-muted hover:text-text-primary"
                    aria-label="Open resource"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
