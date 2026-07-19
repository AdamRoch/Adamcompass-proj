import { NoteEditor } from '@/components/note-editor';
import { PromoteCuriosityButton } from '@/components/promote-curiosity-button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { renderMarkdown } from '@/lib/markdown';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as projectsQ from '@compass/db/queries/projects';
import * as settingsQ from '@compass/db/queries/settings';
import { humanRelative } from '@compass/shared';
import { Inbox as InboxIcon, Sparkles } from 'lucide-react';
import { FilePopover } from './file-popover';

export const dynamic = 'force-dynamic';

const TYPE_HINT_LABEL: Record<string, string> = {
  idea: 'Idea',
  note: 'Note',
  curiosity: 'Curiosity',
  unspecified: 'Unfiled',
};

export default async function InboxPage() {
  const [notes, projects, goals, settings] = await Promise.all([
    notesQ.listInbox(100).catch(() => []),
    projectsQ.listProjects({ limit: 200 }).catch(() => []),
    learningQ.listLearningGoals({ limit: 200 }).catch(() => []),
    settingsQ.getSettings().catch(() => null),
  ]);

  const tz = settings?.timezone ?? 'America/Chicago';

  const projectOpts = projects.map((p) => ({ id: p.id, title: p.title }));
  const goalOpts = goals.map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Unfiled notes captured via ⌘N, the helper, or shortcuts.
          </p>
        </div>
        <div className="text-sm text-text-muted">
          <span className="font-semibold tabular-nums text-text-primary">{notes.length}</span> item
          {notes.length === 1 ? '' : 's'}
        </div>
      </header>

      {notes.length === 0 ? (
        <Card variant="glass" padding="lg">
          <EmptyState
            icon={<Sparkles />}
            title="Inbox zero"
            description="You're caught up. New captures will appear here. Hit ⌘N to capture an idea."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <InboxItem key={note.id} note={note} tz={tz} projects={projectOpts} goals={goalOpts} />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxItem({
  note,
  tz,
  projects,
  goals,
}: {
  note: {
    id: string;
    body_markdown: string;
    inbox_type_hint: string;
    created_at: string;
    title: string | null;
  };
  tz: string;
  projects: Array<{ id: string; title: string }>;
  goals: Array<{ id: string; title: string }>;
}) {
  const hintLabel = TYPE_HINT_LABEL[note.inbox_type_hint] ?? 'Note';
  const html = renderMarkdown(note.body_markdown);
  return (
    <Card variant="glass" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-2xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5 font-semibold uppercase tracking-[0.05em] text-accent">
              <InboxIcon className="size-2.5" aria-hidden />
              {hintLabel}
            </span>
            <span aria-hidden>·</span>
            <span title={new Date(note.created_at).toLocaleString()}>
              {humanRelative(note.created_at, new Date(), tz)}
            </span>
          </div>
          {note.title ? (
            <h3 className="mb-1 text-sm font-medium text-text-primary">{note.title}</h3>
          ) : null}
          <NoteEditor noteId={note.id} body={note.body_markdown} title={note.title}>
            <div
              className="prose-compass text-sm text-text-primary [&>*+*]:mt-1.5 [&_a]:text-accent [&_a:hover]:underline [&_code]:rounded-xs [&_code]:bg-surface-elevated [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </NoteEditor>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {note.inbox_type_hint === 'curiosity' ? (
            <PromoteCuriosityButton noteId={note.id} />
          ) : null}
          <FilePopover noteId={note.id} projects={projects} goals={goals} />
        </div>
      </div>
    </Card>
  );
}
