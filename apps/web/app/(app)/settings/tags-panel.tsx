'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { TagChip } from '@/components/ui/tag-chip';
import { toast } from '@/components/ui/toast';
import { Check, GitMerge, Pencil, Trash2, X } from 'lucide-react';
import { Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export interface TagsPanelProps {
  tags: Array<{ id: string; name: string; count: number }>;
}

export function TagsPanel({ tags }: TagsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [mergingId, setMergingId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function call(path: string, init: RequestInit, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(path, { credentials: 'same-origin', ...init });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast({
          variant: 'danger',
          title: 'Tag update failed',
          description: body?.error?.message ?? `HTTP ${res.status}`,
        });
        return false;
      }
      toast({ variant: 'success', title: okMsg });
      router.refresh();
      return true;
    } catch {
      toast({ variant: 'danger', title: 'Network error' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string) {
    const name = draft.trim().toLowerCase();
    if (!name) return;
    const ok = await call(
      `/api/v1/tags/${id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      },
      'Tag renamed',
    );
    if (ok) setEditingId(null);
  }

  async function remove(id: string) {
    await call(`/api/v1/tags/${id}`, { method: 'DELETE' }, 'Tag deleted');
  }

  async function merge(fromId: string, intoId: string) {
    const ok = await call(
      `/api/v1/tags/${fromId}/merge`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ into: intoId }),
      },
      'Tags merged',
    );
    if (ok) setMergingId(null);
  }

  if (tags.length === 0) {
    return (
      <EmptyState
        icon={<Tag />}
        title="No tags yet"
        description="Tags appear here as you add them to projects, goals, and notes."
      />
    );
  }

  const merging = mergingId ? tags.find((t) => t.id === mergingId) : null;

  return (
    <div className="space-y-2">
      {merging ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-accent-soft/60 px-3 py-2 text-sm">
          <GitMerge className="size-3.5 text-accent" aria-hidden />
          <span>
            Merge <TagChip name={merging.name} /> into…
          </span>
          {tags
            .filter((t) => t.id !== merging.id)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={() => void merge(merging.id, t.id)}
                className="rounded-sm px-1 hover:bg-surface-elevated"
                aria-label={`Merge ${merging.name} into ${t.name}`}
              >
                <TagChip name={t.name} />
              </button>
            ))}
          <Button size="sm" variant="ghost" onClick={() => setMergingId(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-border/40">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            {editingId === t.id ? (
              <>
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void rename(t.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  aria-label={`Rename tag ${t.name}`}
                  wrapperClassName="w-48"
                />
                <button
                  type="button"
                  onClick={() => void rename(t.id)}
                  className="rounded-xs p-1 text-success hover:bg-surface-elevated"
                  aria-label="Save tag name"
                >
                  <Check className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-xs p-1 text-text-muted hover:bg-surface-elevated"
                  aria-label="Cancel rename"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <TagChip name={t.name} />
                <span className="text-2xs tabular-nums text-text-muted">
                  {t.count} item{t.count === 1 ? '' : 's'}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(t.id);
                      setDraft(t.name);
                    }}
                    className="rounded-xs p-1 text-text-muted hover:text-text-primary"
                    aria-label={`Rename tag ${t.name}`}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergingId(t.id)}
                    className="rounded-xs p-1 text-text-muted hover:text-text-primary"
                    aria-label={`Merge tag ${t.name} into another`}
                  >
                    <GitMerge className="size-3.5" aria-hidden />
                  </button>
                  {t.count === 0 ? (
                    <button
                      type="button"
                      onClick={() => void remove(t.id)}
                      className="rounded-xs p-1 text-text-muted hover:text-danger"
                      aria-label={`Delete tag ${t.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
