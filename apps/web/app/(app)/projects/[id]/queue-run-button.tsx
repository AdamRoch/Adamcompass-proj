'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export function QueueRunButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [objective, setObjective] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function queue() {
    const text = objective.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/runs`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ objective: text }),
      });
      if (!res.ok) {
        toast({ variant: 'danger', title: 'Queue failed', description: `HTTP ${res.status}` });
        return;
      }
      toast({ variant: 'success', title: 'Run queued', description: 'Your agent can pick it up.' });
      setObjective('');
      setOpen(false);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" leftIcon={<Zap className="size-3.5" />}>
          Queue run
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`run-objective-${projectId}`}>Objective for the agent</Label>
          <Textarea
            id={`run-objective-${projectId}`}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            placeholder="Ship the auth flow; fix the flaky webhook test; …"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void queue()}
            loading={busy}
            disabled={!objective.trim()}
          >
            Queue
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
