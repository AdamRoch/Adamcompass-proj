'use client';

import { deleteNoteAction, updateNoteAction } from '@/app/(app)/notes/note-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export interface NoteEditorProps {
  noteId: string;
  body: string;
  /** Current note title; pass to enable inline title editing. */
  title?: string | null;
  /** Rendered markdown shown while not editing (server-rendered HTML). */
  children: React.ReactNode;
}

/**
 * Wraps a server-rendered note body with inline edit + delete controls.
 * Editing swaps the rendered markdown for a title input + textarea; delete is two-step inline.
 */
export function NoteEditor({ noteId, body, title, children }: NoteEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(body);
  const [titleDraft, setTitleDraft] = React.useState(title ?? '');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('id', noteId);
      fd.set('body_markdown', text);
      if (title !== undefined) fd.set('title', titleDraft.trim());
      await updateNoteAction(fd);
      setEditing(false);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Failed to save note' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('id', noteId);
      await deleteNoteAction(fd);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Failed to delete note' });
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        {title !== undefined ? (
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="Title (optional)"
            aria-label="Note title"
          />
        ) : null}
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(body);
              setTitleDraft(title ?? '');
            }
          }}
          rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
          aria-label="Edit note body"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void save()} loading={busy} disabled={!draft.trim()}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraft(body);
              setTitleDraft(title ?? '');
            }}
          >
            Cancel
          </Button>
          <span className="ml-auto text-2xs text-text-faint">⌘↵ to save · Esc to cancel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group/note relative">
      {children}
      <div className="absolute -right-1 -top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/note:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => {
            setDraft(body);
            setTitleDraft(title ?? '');
            setEditing(true);
          }}
          className="rounded-sm bg-surface-elevated/90 p-1 text-text-muted shadow-sm hover:text-text-primary"
          aria-label="Edit note"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 rounded-sm bg-surface-elevated/90 px-1 py-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => void remove()}
              className="text-2xs font-semibold text-danger hover:underline"
              aria-label="Confirm delete note"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-2xs text-text-muted hover:underline"
              aria-label="Cancel delete"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-sm bg-surface-elevated/90 p-1 text-text-muted shadow-sm hover:text-danger"
            aria-label="Delete note"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
