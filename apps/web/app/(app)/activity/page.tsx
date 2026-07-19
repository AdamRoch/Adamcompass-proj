import { ActivityEventRow } from '@/components/ui/activity-event-row';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import * as activityQ from '@compass/db/queries/activity';
import * as buildRunsQ from '@compass/db/queries/build_runs';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as projectsQ from '@compass/db/queries/projects';
import type { EntityType } from '@compass/shared';
import { ArrowDown, Radio } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TYPE_FILTERS: Array<{ key: string; label: string; types?: EntityType[] }> = [
  { key: 'all', label: 'All' },
  { key: 'projects', label: 'Projects', types: ['project', 'milestone', 'build_run'] },
  { key: 'learning', label: 'Learning', types: ['learning_goal', 'checklist_item', 'resource'] },
  { key: 'notes', label: 'Notes', types: ['note'] },
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filterKey = TYPE_FILTERS.some((f) => f.key === sp.filter) ? (sp.filter ?? 'all') : 'all';
  const filter = TYPE_FILTERS.find((f) => f.key === filterKey);
  const cursor = sp.cursor ?? null;

  const page = await activityQ
    .recentPaged({ cursor, types: filter?.types, limit: 50 })
    .catch(() => ({ events: [], next_cursor: null }));

  // Enrich rows with real titles (events store ids, not names) so the feed reads as
  // "created project · Compass" instead of "created project · project".
  const [projects, goals] = await Promise.all([
    projectsQ.listProjects({ includeArchived: true, limit: 500 }).catch(() => []),
    learningQ.listLearningGoals({ includeArchived: true, limit: 500 }).catch(() => []),
  ]);
  const titleByEntity = new Map<string, string>();
  const projectTitleById = new Map<string, string>();
  for (const p of projects) {
    titleByEntity.set(`project:${p.id}`, p.title);
    projectTitleById.set(p.id, p.title);
  }
  for (const g of goals) titleByEntity.set(`learning_goal:${g.id}`, g.title);

  const runHref = new Map<string, string>();
  const distinct = <T,>(xs: T[]) => Array.from(new Set(xs));
  await Promise.all(
    distinct(page.events.filter((e) => e.entity_type === 'build_run').map((e) => e.entity_id)).map(
      async (id) => {
        const run = await buildRunsQ.get(id).catch(() => null);
        if (!run) return;
        const projectTitle = projectTitleById.get(run.project_id);
        titleByEntity.set(
          `build_run:${id}`,
          run.objective ?? (projectTitle ? `run on ${projectTitle}` : 'build run'),
        );
        runHref.set(id, `/projects/${run.project_id}`);
      },
    ),
  );
  await Promise.all(
    distinct(page.events.filter((e) => e.entity_type === 'note').map((e) => e.entity_id)).map(
      async (id) => {
        const note = await notesQ.getNote(id).catch(() => null);
        if (!note) return;
        const firstLine = note.body_markdown.split('\n')[0]?.slice(0, 80) ?? '';
        titleByEntity.set(`note:${id}`, note.title || firstLine || 'note');
      },
    ),
  );

  const hrefFor = (e: { entity_type: string; entity_id: string }) => {
    if (e.entity_type === 'project') return `/projects/${e.entity_id}`;
    if (e.entity_type === 'learning_goal') return `/learning/${e.entity_id}`;
    if (e.entity_type === 'build_run') return runHref.get(e.entity_id);
    return undefined;
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          Activity
        </h1>
        <p className="mt-1 text-sm text-text-muted">Everything that happened, newest first.</p>
      </header>

      <nav className="flex items-center gap-1" aria-label="Activity filters">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/activity' : `/activity?filter=${f.key}`}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm',
              filterKey === f.key
                ? 'bg-accent-soft font-medium text-accent'
                : 'text-text-muted hover:bg-surface-elevated hover:text-text-primary',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {page.events.length === 0 ? (
        <Card variant="glass" padding="lg">
          <EmptyState
            icon={<Radio />}
            title="No activity yet"
            description="Events appear here as you capture, file, build, and learn."
          />
        </Card>
      ) : (
        <Card variant="glass" padding="md">
          <div className="flex flex-col">
            {page.events.map((evt) => (
              <ActivityEventRow
                key={evt.id}
                event={evt}
                href={hrefFor(evt)}
                entityTitle={titleByEntity.get(`${evt.entity_type}:${evt.entity_id}`)}
              />
            ))}
          </div>
          {page.next_cursor ? (
            <div className="mt-3 flex justify-center border-t border-border/40 pt-3">
              <Link
                href={`/activity?${new URLSearchParams({
                  ...(filterKey !== 'all' ? { filter: filterKey } : {}),
                  cursor: page.next_cursor,
                }).toString()}`}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-elevated hover:text-text-primary"
              >
                <ArrowDown className="size-3.5" aria-hidden /> Older
              </Link>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
