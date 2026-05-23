import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Calendar, ExternalLink, FileText, Target } from 'lucide-react';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as resourcesQ from '@compass/db/queries/resources';
import * as activityQ from '@compass/db/queries/activity';
import * as tagsQ from '@compass/db/queries/tags';
import * as settingsQ from '@compass/db/queries/settings';
import * as checklistQ from '@compass/db/queries/checklist';
import { humanRelative, type ActivityEvent, type Note } from '@compass/shared';
import type { ResourceRow } from '@compass/db/queries/resources';
import { ActivityEventRow } from '@/components/ui/activity-event-row';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SnoozeBadge } from '@/components/ui/snooze-badge';
import { TagChip } from '@/components/ui/tag-chip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { renderMarkdown } from '@/lib/markdown';
import { AddNote } from '../../projects/[id]/add-note';
import { SnoozePopover } from '../../projects/[id]/snooze-popover';
import { TitleEdit } from '../../projects/[id]/title-edit';
import { Checklist } from './checklist';
import type { ChecklistItemRow } from './checklist-actions';
import { StatusSelect } from './status-select';

export const dynamic = 'force-dynamic';

const READING_STATUS_LABEL: Record<string, string> = {
  to_read: 'To read',
  reading: 'Reading',
  read: 'Read',
  abandoned: 'Abandoned',
};

export default async function LearningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = await learningQ.getLearningGoal(id).catch(() => null);
  if (!goal) notFound();

  const notesP: Promise<Note[]> = notesQ.listNotesForEntity('learning_goal', id).catch(() => []);
  const resP: Promise<ResourceRow[]> = resourcesQ
    .list({ learning_goal_id: id })
    .catch(() => []);
  const actsP: Promise<ActivityEvent[]> = activityQ
    .listForEntity('learning_goal', id, 50)
    .catch(() => []);
  const tagsP: Promise<Array<{ id: string; name: string }>> = tagsQ
    .tagsForEntity('learning_goal', id)
    .catch(() => []);
  const settingsP = settingsQ.getSettings().catch(() => null);
  const chP: Promise<ChecklistItemRow[]> = checklistQ.listForGoal(id).catch(() => []);
  const [notes, resources, activity, tags, settings, checklist] = await Promise.all([
    notesP,
    resP,
    actsP,
    tagsP,
    settingsP,
    chP,
  ]);

  const tz = settings?.timezone ?? 'America/Chicago';
  const doneCount = checklist.filter((c: ChecklistItemRow) => c.done).length;

  return (
    <div className="space-y-5">
      <Link
        href="/learning"
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3" aria-hidden /> Learning
      </Link>

      <header className="space-y-3">
        <TitleEdit entity="learning-goals" id={id} initial={goal.title} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <StatusSelect id={id} current={goal.status} />
          <span aria-hidden>·</span>
          <span title={new Date(goal.last_touched_at).toLocaleString()}>
            touched {humanRelative(goal.last_touched_at, new Date(), tz)}
          </span>
          {checklist.length > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>
                {doneCount}/{checklist.length} done
              </span>
            </>
          ) : null}
          {goal.target_date ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" aria-hidden /> target {goal.target_date}
              </span>
            </>
          ) : null}
          {goal.snoozed_until && goal.snoozed_until > new Date().toISOString() ? (
            <SnoozeBadge until={goal.snoozed_until} reason={goal.snooze_reason ?? undefined} />
          ) : null}
          {tags.length > 0 ? (
            <div className="inline-flex items-center gap-1.5">
              {tags.map((t: { id: string; name: string }) => (
                <TagChip key={t.id} name={t.name} />
              ))}
            </div>
          ) : null}
          <div className="ml-auto">
            <SnoozePopover entity="learning-goals" id={id} snoozedUntil={goal.snoozed_until} />
          </div>
        </div>
        {goal.motivation ? (
          <p className="rounded-md bg-surface-elevated/40 px-3 py-2 text-sm text-text-primary">
            <span className="text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
              Motivation
            </span>
            <br />
            {goal.motivation}
          </p>
        ) : null}
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist">
            Checklist
            {checklist.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{checklist.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="resources">
            Resources
            {resources.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{resources.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {notes.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{notes.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card variant="glass" padding="md">
            {goal.body_markdown ? (
              <div
                className="prose-compass text-sm text-text-primary [&>*+*]:mt-3 [&_a]:text-accent [&_a:hover]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_code]:rounded-xs [&_code]:bg-surface-elevated [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-elevated [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(goal.body_markdown) }}
              />
            ) : (
              <EmptyState
                icon={<Target />}
                title="No description yet"
                description="Add notes about what you want to learn and how you'll know you've internalized it."
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <Checklist goalId={id} items={checklist} />
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card variant="glass" padding="md">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Resources</CardTitle>
              <Link href={`/learning/reading?goal=${id}`}>
                <span className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
                  <BookOpen className="size-3" aria-hidden /> Go to reading list
                </span>
              </Link>
            </div>
            {resources.length === 0 ? (
              <EmptyState
                icon={<BookOpen />}
                title="No resources yet"
                description="Add reading material, videos, or courses related to this goal."
              />
            ) : (
              <div className="flex flex-col divide-y divide-border/40">
                {resources.map((r) => (
                  <div key={r.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-sm bg-surface-elevated px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                        {r.kind}
                      </span>
                      <span className="inline-flex items-center rounded-sm bg-accent-soft px-1.5 py-0.5 text-2xs font-semibold text-accent">
                        {READING_STATUS_LABEL[r.reading_status]}
                      </span>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-2xs text-accent hover:underline"
                        >
                          <ExternalLink className="size-3" aria-hidden />
                          Open
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">{r.title}</div>
                    {r.author_source ? (
                      <div className="text-xs text-text-muted">{r.author_source}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card variant="glass" padding="md">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Notes</CardTitle>
              <AddNote entityType="learning_goal" entityId={id} />
            </div>
            {notes.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No notes yet"
                description="Capture observations, surprises, or open questions as you learn."
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
                  <ActivityEventRow key={evt.id} event={evt} entityTitle={goal.title} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
