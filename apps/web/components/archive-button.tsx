'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export interface ArchiveButtonProps {
  /** Entity kind for the API path: `projects` or `learning-goals`. */
  entity: 'projects' | 'learning-goals';
  id: string;
  archived: boolean;
}

export function ArchiveButton({ entity, id, archived }: ArchiveButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function post(action: 'archive' | 'restore', body?: object) {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/${entity}/${id}/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        toast({ variant: 'danger', title: `${action} failed`, description: `HTTP ${res.status}` });
        return;
      }
      toast({ variant: 'success', title: action === 'archive' ? 'Archived' : 'Restored' });
      setOpen(false);
      setReason('');
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  if (archived) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void post('restore')}
        loading={busy}
        leftIcon={<ArchiveRestore className="size-3.5" />}
      >
        Restore
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" leftIcon={<Archive className="size-3.5" />}>
          Archive
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`archive-reason-${id}`}>Why park this? (optional)</Label>
          <Textarea
            id={`archive-reason-${id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Superseded by…, lost interest because…"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void post('archive', reason.trim() ? { reason: reason.trim() } : {})}
            loading={busy}
          >
            Archive
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
