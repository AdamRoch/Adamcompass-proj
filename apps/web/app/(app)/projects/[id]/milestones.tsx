'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronUp, Flag, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  type MilestoneRow,
  addMilestone,
  moveMilestone,
  removeMilestone,
  seedMilestonesFromPrd,
  toggleMilestone,
} from './milestone-actions';

export interface MilestonesProps {
  projectId: string;
  items: MilestoneRow[];
  /** True when the project's PRD has a `## Requirements` section to seed from. */
  canSeedFromPrd?: boolean;
}

export function Milestones({ projectId, items, canSeedFromPrd }: MilestonesProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const doneCount = items.filter((i) => i.done).length;

  async function run(action: (fd: FormData) => Promise<void>, fields: Record<string, string>) {
    if (busy) return; // one in-flight mutation at a time — rapid re-clicks would double-fire
    setBusy(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    try {
      await action(fd);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Milestone update failed' });
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const t = title.trim();
    if (!t || busy) return;
    await run(addMilestone, { project_id: projectId, title: t });
    setTitle('');
    setAddOpen(false);
  }

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <div className="flex items-center gap-2">
          {/* Decorative bar; the adjacent "done/total" text is the accessible value. */}
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
            />
          </div>
          <span className="text-2xs tabular-nums text-text-muted">
            {doneCount}/{items.length} done
          </span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<Flag />}
          title="No milestones yet"
          description="Break the build into shippable steps — progress derives from them."
          action={
            canSeedFromPrd ? (
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() => void run(seedMilestonesFromPrd, { project_id: projectId })}
              >
                Seed from PRD requirements
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className={cn(
                'group flex items-center gap-3 rounded-sm px-2 py-1.5',
                'hover:bg-surface-elevated/60',
              )}
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={() =>
                  void run(toggleMilestone, { id: item.id, project_id: projectId })
                }
                aria-label={item.done ? 'Mark incomplete' : 'Mark done'}
              />
              <span
                className={cn(
                  'flex-1 text-sm',
                  item.done ? 'text-text-muted line-through' : 'text-text-primary',
                )}
              >
                {item.title}
              </span>
              <span className="invisible flex items-center gap-0.5 group-hover:visible">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() =>
                    void run(moveMilestone, { id: item.id, project_id: projectId, direction: 'up' })
                  }
                  className="rounded-xs p-0.5 text-text-faint hover:text-text-primary disabled:opacity-30"
                  aria-label={`Move ${item.title} up`}
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={idx === items.length - 1}
                  onClick={() =>
                    void run(moveMilestone, {
                      id: item.id,
                      project_id: projectId,
                      direction: 'down',
                    })
                  }
                  className="rounded-xs p-0.5 text-text-faint hover:text-text-primary disabled:opacity-30"
                  aria-label={`Move ${item.title} down`}
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void run(removeMilestone, { id: item.id, project_id: projectId })}
                  className="rounded-xs p-0.5 text-text-faint hover:text-danger"
                  aria-label={`Delete milestone ${item.title}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {addOpen ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
              if (e.key === 'Escape') setAddOpen(false);
            }}
            placeholder="Milestone title"
            aria-label="New milestone title"
            wrapperClassName="flex-1"
          />
          <Button size="sm" onClick={handleAdd} loading={busy} disabled={!title.trim()}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAddOpen(false);
              setTitle('');
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAddOpen(true)}
          leftIcon={<Plus className="size-3.5" />}
        >
          Add milestone
        </Button>
      )}
    </div>
  );
}
