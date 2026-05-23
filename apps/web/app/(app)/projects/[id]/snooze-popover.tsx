'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '1d', days: 1 },
  { label: '3d', days: 3 },
  { label: '1w', days: 7 },
  { label: '2w', days: 14 },
];

export interface SnoozePopoverProps {
  /** Entity kind for the API path: `projects` or `learning-goals`. */
  entity: 'projects' | 'learning-goals';
  id: string;
  /** Currently set snoozed_until ISO, if any (controls "Unsnooze" affordance). */
  snoozedUntil?: string | null;
}

export function SnoozePopover({ entity, id, snoozedUntil }: SnoozePopoverProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState(3);
  const [customDate, setCustomDate] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const isSnoozed = !!snoozedUntil && snoozedUntil > new Date().toISOString();

  function computeUntil(): string | null {
    if (customDate) {
      // Treat date input as local midnight; convert to UTC ISO.
      const dt = new Date(`${customDate}T00:00:00`);
      if (Number.isNaN(dt.valueOf())) return null;
      return dt.toISOString();
    }
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  }

  async function snooze() {
    const until = computeUntil();
    if (!until) {
      toast({ variant: 'danger', title: 'Pick a date or duration' });
      return;
    }
    const r = reason.trim() || 'Snoozed';
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/${entity}/${id}/snooze`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ until, reason: r }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Snooze failed',
          description: text || `Server responded ${res.status}`,
        });
        return;
      }
      toast({ variant: 'success', title: 'Snoozed' });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Snooze failed',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function unsnooze() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/${entity}/${id}/unsnooze`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast({ variant: 'danger', title: 'Failed to unsnooze' });
        return;
      }
      toast({ variant: 'success', title: 'Unsnoozed' });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" leftIcon={<Moon className="size-3.5" />}>
          {isSnoozed ? 'Snoozed' : 'Snooze'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] max-w-none p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-text-muted">
          Snooze for
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setDays(p.days);
                setCustomDate('');
              }}
              className={cn(
                'inline-flex h-7 items-center rounded-sm border px-2 text-2xs font-semibold uppercase tracking-[0.05em]',
                'transition-colors',
                days === p.days && !customDate
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-border bg-surface-sunken/60 text-text-muted hover:text-text-primary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mb-3 space-y-1">
          <Label htmlFor="snooze-date" className="text-xs">
            Or pick a date
          </Label>
          <Input
            id="snooze-date"
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
          />
        </div>

        <div className="mb-3 space-y-1">
          <Label htmlFor="snooze-reason" className="text-xs">
            Reason
          </Label>
          <Textarea
            id="snooze-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you snoozing?"
            minRows={2}
            maxRows={4}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {isSnoozed ? (
            <Button variant="ghost" size="sm" onClick={unsnooze} loading={busy}>
              Unsnooze
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={snooze} loading={busy}>
              Snooze
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
