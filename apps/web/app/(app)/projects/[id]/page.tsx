import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Code2,
  ExternalLink,
  FileText,
  Globe,
  Palette,
  Zap,
} from 'lucide-react';
import * as projectsQ from '@compass/db/queries/projects';
import * as notesQ from '@compass/db/queries/notes';
import * as buildRunsQ from '@compass/db/queries/build_runs';
import * as activityQ from '@compass/db/queries/activity';
import * as tagsQ from '@compass/db/queries/tags';
import * as settingsQ from '@compass/db/queries/settings';
import { humanRelative, type ActivityEvent, type Note } from '@compass/shared';
import type { BuildRunRow } from '@compass/db/queries/build_runs';
import { ActivityEventRow } from '@/components/ui/activity-event-row';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StagePill } from '@/components/ui/stage-pill';
import { SnoozeBadge } from '@/components/ui/snooze-badge';
import { TagChip } from '@/components/ui/tag-chip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { renderMarkdown } from '@/lib/markdown';
import { AddNote } from './add-note';
import { SnoozePopover } from './snooze-popover';
import { StageSelect } from './stage-select';
import { TitleEdit } from './title-edit';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await projectsQ.getProject(id).catch(() => null);
  if (!project) notFound();

  const notesP: Promise<Note[]> = notesQ.listNotesForEntity('project', id).catch(() => []);
  const runsP: Promise<BuildRunRow[]> = buildRunsQ.listForProject(id).catch(() => []);
  const actsP: Promise<ActivityEvent[]> = activityQ
    .listForEntity('project', id, 50)
    .catch(() => []);
  const tagsP: Promise<Array<{ id: string; name: string }>> = tagsQ
    .tagsForEntity('project', id)
    .catch(() => []);
  const settingsP = settingsQ.getSettings().catch(() => null);
  const [notes, buildRuns, activity, tags, settings] = await Promise.all([
    notesP,
    runsP,
    actsP,
    tagsP,
    settingsP,
  ]);

  const tz = settings?.timezone ?? 'America/Chicago';
  const links: Array<{ kind: string; url: string; icon: React.ComponentType<{ className?: string }> }> = [];
  if (project.repo_url) links.push({ kind: 'Repo', url: project.repo_url, icon: Code2 });
  if (project.deploy_url) links.push({ kind: 'Deploy', url: project.deploy_url, icon: Globe });
  if (project.design_url) links.push({ kind: 'Design', url: project.design_url, icon: Palette });
  if (project.prd_url) links.push({ kind: 'PRD', url: project.prd_url, icon: FileText });

  return (
    <div className="space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3" aria-hidden /> Projects
      </Link>

      <header className="space-y-3">
        <TitleEdit entity="projects" id={id} initial={project.title} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <StageSelect id={id} current={project.stage} />
          <span aria-hidden>·</span>
          <span title={new Date(project.last_touched_at).toLocaleString()}>
            touched {humanRelative(project.last_touched_at, new Date(), tz)}
          </span>
          {project.target_date ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" aria-hidden /> target {project.target_date}
              </span>
            </>
          ) : null}
          {project.progress_pct !== null ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">{project.progress_pct}%</span>
            </>
          ) : null}
          {project.snoozed_until && project.snoozed_until > new Date().toISOString() ? (
            <SnoozeBadge
              until={project.snoozed_until}
              reason={project.snooze_reason ?? undefined}
            />
          ) : null}
          {tags.length > 0 ? (
            <div className="inline-flex items-center gap-1.5">
              {tags.map((t: { id: string; name: string }) => (
                <TagChip key={t.id} name={t.name} />
              ))}
            </div>
          ) : null}
          <div className="ml-auto">
            <SnoozePopover entity="projects" id={id} snoozedUntil={project.snoozed_until} />
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {notes.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{notes.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="build_runs">
            Build runs
            {buildRuns.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{buildRuns.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card variant="glass" padding="md" className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              {project.summary ? (
                <p className="text-sm text-text-primary">{project.summary}</p>
              ) : (
                <p className="text-sm italic text-text-muted">
                  No summary yet. Edit the project to add one.
                </p>
              )}
              {project.body_markdown ? (
                <div
                  className="prose-compass mt-4 text-sm text-text-primary [&>*+*]:mt-3 [&_a]:text-accent [&_a:hover]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_code]:rounded-xs [&_code]:bg-surface-elevated [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-elevated [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(project.body_markdown) }}
                />
              ) : null}
            </Card>

            <Card variant="glass" padding="md">
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              {links.length === 0 ? (
                <p className="text-sm italic text-text-muted">No links yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {links.map(({ kind, url, icon: Icon }) => (
                    <li key={kind}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-sm px-1 py-0.5 text-accent hover:bg-accent-soft"
                      >
                        <Icon className="size-3.5" aria-hidden />
                        <span>{kind}</span>
                        <ExternalLink className="size-3 text-text-faint" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <Card variant="glass" padding="md">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Notes</CardTitle>
              <AddNote entityType="project" entityId={id} />
            </div>
            {notes.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No notes yet"
                description="Add observations, design decisions, or links to this project."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-md border border-border/60 p-3">
                    <div className="mb-1 text-2xs text-text-muted">
                      {humanRelative(note.created_at, new Date(), tz)}
                    </div>
                    <div
                      className="prose-compass text-sm text-text-primary [&>*+*]:mt-1.5 [&_a]:text-accent [&_a:hover]:underline [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body_markdown) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="build_runs">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Build runs</CardTitle>
            </CardHeader>
            {buildRuns.length === 0 ? (
              <EmptyState
                icon={<Zap />}
                title="No build runs"
                description="Webhook-delivered build runs will appear here."
              />
            ) : (
              <div className="flex flex-col divide-y divide-border/40">
                {buildRuns.map((r) => {
                  const links: Array<{ kind: string; url: string; label?: string }> =
                    JSON.parse(r.links_json ?? '[]');
                  return (
                    <div key={r.id} className="py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            r.status === 'completed'
                              ? 'inline-flex items-center gap-1 rounded-sm bg-success/15 px-1.5 py-0.5 text-2xs font-semibold uppercase text-success'
                              : r.status === 'failed'
                              ? 'inline-flex items-center gap-1 rounded-sm bg-danger/15 px-1.5 py-0.5 text-2xs font-semibold uppercase text-danger'
                              : r.status === 'running'
                              ? 'inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5 text-2xs font-semibold uppercase text-accent'
                              : 'inline-flex items-center gap-1 rounded-sm bg-surface-elevated px-1.5 py-0.5 text-2xs font-semibold uppercase text-text-muted'
                          }
                        >
                          {r.status}
                        </span>
                        <span className="text-text-primary">{r.objective ?? 'Build run'}</span>
                        <span className="ml-auto text-2xs text-text-muted">
                          {humanRelative(r.created_at, new Date(), tz)}
                        </span>
                      </div>
                      {r.body_markdown ? (
                        <div
                          className="prose-compass mt-1.5 text-xs text-text-muted [&>*+*]:mt-1 [&_a]:text-accent [&_a:hover]:underline [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(r.body_markdown),
                          }}
                        />
                      ) : null}
                      {links.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {links.map((l, i) => (
                            <a
                              key={i}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-2xs text-accent hover:underline"
                            >
                              <ExternalLink className="size-2.5" aria-hidden />
                              {l.label ?? l.kind}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            {activity.length === 0 ? (
              <p className="text-sm italic text-text-muted">No activity yet.</p>
            ) : (
              <div className="flex flex-col">
                {activity.map((evt) => (
                  <ActivityEventRow key={evt.id} event={evt} entityTitle={project.title} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
