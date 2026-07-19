'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { FileText, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

const TEMPLATE = `## Problem

What hurts today, and for whom?

## Goals

-

## Requirements

-
-

## Scope

In:
Out:
`;

export interface PrdEditorProps {
  projectId: string;
  prdMarkdown: string | null;
  /** Server-rendered markdown of the saved PRD (shown while not editing). */
  children: React.ReactNode;
}

export function PrdEditor({ projectId, prdMarkdown, children }: PrdEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(prdMarkdown ?? '');
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prd_markdown: draft }),
      });
      if (!res.ok) {
        toast({ variant: 'danger', title: 'Save failed', description: `HTTP ${res.status}` });
        return;
      }
      toast({ variant: 'success', title: 'PRD saved' });
      setEditing(false);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(prdMarkdown ?? '');
            }
          }}
          rows={Math.min(28, Math.max(10, draft.split('\n').length + 2))}
          className="font-mono text-xs leading-relaxed"
          aria-label="PRD markdown"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void save()} loading={busy}>
            Save PRD
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraft(prdMarkdown ?? '');
            }}
          >
            Cancel
          </Button>
          <span className="ml-auto text-2xs text-text-faint">⌘↵ to save · Esc to cancel</span>
        </div>
      </div>
    );
  }

  if (!prdMarkdown) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <FileText className="size-6 text-text-faint" aria-hidden />
        <p className="max-w-sm text-sm text-text-muted">
          No PRD yet. Write one in-app — promoting to Building can seed milestones straight from its
          requirements.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft(TEMPLATE);
            setEditing(true);
          }}
        >
          Start from template
        </Button>
      </div>
    );
  }

  return (
    <div className="group/prd relative">
      {children}
      <Button
        size="sm"
        variant="ghost"
        className="absolute -right-1 -top-1 opacity-0 transition-opacity group-hover/prd:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          setDraft(prdMarkdown);
          setEditing(true);
        }}
        leftIcon={<Pencil className="size-3.5" />}
      >
        Edit
      </Button>
    </div>
  );
}
