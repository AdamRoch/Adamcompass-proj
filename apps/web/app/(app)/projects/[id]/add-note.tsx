'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { getClientId } from '@/lib/capture-client-id';

export interface AddNoteProps {
  /** `project` or `learning_goal`. Used by the capture endpoint to file directly. */
  entityType: 'project' | 'learning_goal';
  entityId: string;
}

/**
 * Inline "add a note" form. Captures the note pre-filed to a target entity via
 * the standard capture endpoint with an idempotency key. The note immediately
 * lands attached to the entity (no inbox stopover).
 */
export function AddNote({ entityType, entityId }: AddNoteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      // Use the capture endpoint to create the note; then immediately file it.
      // This avoids needing a dedicated /notes POST.
      const idem = crypto.randomUUID();
      const client_id = getClientId();
      const capRes = await fetch('/api/v1/captures', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idem_key: idem,
          client_id,
          body: trimmed,
          type_hint: 'note',
          tags: [],
        }),
      });
      if (!capRes.ok) {
        toast({ variant: 'danger', title: 'Failed to add note' });
        return;
      }
      const cap = (await capRes.json()) as { note: { id: string }; duplicate?: boolean };
      // File it to the target entity.
      const fileRes = await fetch(`/api/v1/inbox/${cap.note.id}/file`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target: 'existing',
          target_type: entityType,
          target_id: entityId,
        }),
      });
      if (!fileRes.ok) {
        toast({
          variant: 'warning',
          title: 'Note captured but not filed',
          description: 'It landed in the inbox; try filing manually.',
        });
      } else {
        toast({ variant: 'success', title: 'Note added' });
      }
      setBody('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Failed to add note',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={<Plus className="size-3.5" />}
      >
        Add note
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note..."
        minRows={3}
        maxRows={8}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setBody('');
          }}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={submit} loading={busy} disabled={!body.trim()}>
          Add note
        </Button>
      </div>
    </div>
  );
}
