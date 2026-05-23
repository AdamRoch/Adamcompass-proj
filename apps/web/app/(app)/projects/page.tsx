import * as React from 'react';
import Link from 'next/link';
import { Folder } from 'lucide-react';
import * as projectsQ from '@compass/db/queries/projects';
import * as tagsQ from '@compass/db/queries/tags';
import * as settingsQ from '@compass/db/queries/settings';
import { humanRelative, type ProjectStage } from '@compass/shared';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { StagePill } from '@/components/ui/stage-pill';
import { StallBadge } from '@/components/ui/stall-badge';
import { SnoozeBadge } from '@/components/ui/snooze-badge';
import { TagChip } from '@/components/ui/tag-chip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewProjectDialog } from './new-project-dialog';

export const dynamic = 'force-dynamic';

const STAGE_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Idea' },
  { value: 'prd', label: 'PRD' },
  { value: 'building', label: 'Building' },
  { value: 'review', label: 'Review' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'archived', label: 'Archived' },
];

function daysBetween(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface SearchParams {
  stage?: string;
  snoozed?: string;
  tag?: string;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const stageParam = (params.stage ?? 'all').toLowerCase();
  const snoozedParam = (params.snoozed ?? 'show').toLowerCase();
  const tagParam = params.tag ?? null;

  const includeArchived = stageParam === 'archived' || stageParam === 'all';
  const stageFilter =
    stageParam !== 'all' && stageParam !== 'archived' ? (stageParam as ProjectStage) : undefined;

  const [allProjects, settings] = await Promise.all([
    projectsQ
      .listProjects({
        stage: stageFilter,
        includeArchived,
        limit: 500,
      })
      .catch(() => []),
    settingsQ.getSettings().catch(() => null),
  ]);

  const tz = settings?.timezone ?? 'America/Chicago';
  const defaultStall = settings?.default_stall_threshold_project_days ?? 3;
  const nowIso = new Date().toISOString();

  // If stage=archived was selected, the includeArchived flag returns ALL stages —
  // narrow down by hand for that case.
  let projects = allProjects;
  if (stageParam === 'archived') {
    projects = projects.filter((p) => p.stage === 'archived');
  }

  // Tags & snoozed filters
  const projectsWithTags = await Promise.all(
    projects.map(async (p) => {
      const tags = await tagsQ.tagsForEntity('project', p.id).catch(() => []);
      return { project: p, tags };
    }),
  );

  let filtered = projectsWithTags;
  if (snoozedParam === 'hidden') {
    filtered = filtered.filter(({ project }) => {
      const s = project.snoozed_until;
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
    new Set(projectsWithTags.flatMap(({ tags }) => tags.map((t: { name: string }) => t.name))),
  ).sort();

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Projects
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            <span className="font-semibold tabular-nums text-text-primary">
              {filtered.length}
            </span>{' '}
            of {projectsWithTags.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectDialog />
        </div>
      </header>

      {/* Stage filter tabs */}
      <Tabs value={stageParam}>
        <TabsList className="flex flex-wrap">
          {STAGE_TABS.map((s) => (
            <TabsTrigger key={s.value} value={s.value} asChild>
              <Link
                href={{
                  pathname: '/projects',
                  query: {
                    ...(s.value !== 'all' ? { stage: s.value } : {}),
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
            pathname: '/projects',
            query: {
              ...(stageParam !== 'all' ? { stage: stageParam } : {}),
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
            pathname: '/projects',
            query: {
              ...(stageParam !== 'all' ? { stage: stageParam } : {}),
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
                  pathname: '/projects',
                  query: {
                    ...(stageParam !== 'all' ? { stage: stageParam } : {}),
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
                    pathname: '/projects',
                    query: {
                      ...(stageParam !== 'all' ? { stage: stageParam } : {}),
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
            icon={<Folder />}
            title={projectsWithTags.length === 0 ? 'No projects yet' : 'No projects match'}
            description={
              projectsWithTags.length === 0
                ? 'Create your first project to start tracking it here.'
                : 'Try a different stage or clear the filters.'
            }
            action={projectsWithTags.length === 0 ? <NewProjectDialog /> : undefined}
          />
        </Card>
      ) : (
        <Card variant="glass" padding="none">
          <div className="flex flex-col divide-y divide-border/40">
            {filtered.map(({ project, tags }) => {
              const days = daysBetween(project.last_touched_at, nowIso);
              const threshold = project.stall_threshold_days ?? defaultStall;
              const isSnoozed = !!project.snoozed_until && project.snoozed_until > nowIso;
              const isStalled = !isSnoozed && days >= threshold && project.stage !== 'shipped' && project.stage !== 'archived';
              return (
                <ListItem
                  key={project.id}
                  dense
                  href={`/projects/${project.id}`}
                  icon={<Folder className="size-3.5" />}
                  title={project.title}
                  meta={`touched ${humanRelative(project.last_touched_at, new Date(), tz)}`}
                  snoozed={isSnoozed}
                  badges={
                    <>
                      <StagePill stage={project.stage} />
                      {isStalled ? <StallBadge days={days} /> : null}
                      {isSnoozed && project.snoozed_until ? (
                        <SnoozeBadge
                          until={project.snoozed_until}
                          reason={project.snooze_reason ?? undefined}
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
