import { NoteEditor } from '@/components/note-editor';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { renderMarkdown } from '@/lib/markdown';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as projectsQ from '@compass/db/queries/projects';
import * as settingsQ from '@compass/db/queries/settings';
import { type Note, humanRelative } from '@compass/shared';
import { StickyNote } from 'lucide-react';
import Link from 'next/link';
import { FilePopover } from '../inbox/file-popover';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unfiled', label: 'Unfiled' },
  { key: 'filed', label: 'Filed' },
] as const;

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filter = sp.filter === 'unfiled' || sp.filter === 'filed' ? sp.filter : 'all';

  const [notes, projects, goals, settings] = await Promise.all([
    notesQ.listAllNotes({ filed: filter === 'all' ? undefined : filter }).catch(() => []),
    projectsQ.listProjects({ limit: 200 }).catch(() => []),
    learningQ.listLearningGoals({ limit: 200 }).catch(() => []),
    settingsQ.getSettings().catch(() => null),
  ]);

  const tz = settings?.timezone ?? 'America/Chicago';
  const projectOpts = projects.map((p) => ({ id: p.id, title: p.title }));
  const goalOpts = goals.map((g) => ({ id: g.id, title: g.title }));
  const titleById = new Map<string, { title: string; href: string }>();
  for (const p of projects) titleById.set(p.id, { title: p.title, href: `/projects/${p.id}` });
  for (const g of goals) titleById.set(g.id, { title: g.title, href: `/learning/${g.id}` });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Notes
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Everything worth keeping — filed into projects and goals, or floating free.
          </p>
        </div>
        <div className="text-sm text-text-muted">
          <span className="font-semibold tabular-nums text-text-primary">{notes.length}</span> note
          {notes.length === 1 ? '' : 's'}
        </div>
      </header>

      <nav className="flex items-center gap-1" aria-label="Note filters">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/notes' : `/notes?filter=${f.key}`}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm',
              filter === f.key
                ? 'bg-accent-soft font-medium text-accent'
                : 'text-text-muted hover:bg-surface-elevated hover:text-text-primary',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {notes.length === 0 ? (
        <Card variant="glass" padding="lg">
          <EmptyState
            icon={<StickyNote />}
            title="No notes here"
            description="Capture with ⌘N — notes land in the Inbox and can be filed anywhere."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tz={tz}
              parent={note.entity_id ? titleById.get(note.entity_id) : undefined}
              projects={projectOpts}
              goals={goalOpts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  tz,
  parent,
  projects,
  goals,
}: {
  note: Note;
  tz: string;
  parent?: { title: string; href: string };
  projects: Array<{ id: string; title: string }>;
  goals: Array<{ id: string; title: string }>;
}) {
  const html = renderMarkdown(note.body_markdown);
  return (
    <Card variant="glass" padding="md">
      <div className="mb-1.5 flex items-center gap-2 text-2xs text-text-muted">
        {parent ? (
          <Link
            href={parent.href}
            className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5 font-semibold text-accent hover:underline"
          >
            {parent.title}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-sm bg-surface-elevated px-1.5 py-0.5 font-semibold uppercase tracking-[0.05em]">
            Unfiled
          </span>
        )}
        <span aria-hidden>·</span>
        <span title={new Date(note.last_touched_at).toLocaleString()}>
          {humanRelative(note.last_touched_at, new Date(), tz)}
        </span>
        {!parent ? (
          <span className="ml-auto">
            <FilePopover noteId={note.id} projects={projects} goals={goals} />
          </span>
        ) : null}
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
    </Card>
  );
}
