'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { CheckSquare } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { addChecklistItem, toggleChecklistItem, type ChecklistItemRow } from './checklist-actions';

export interface ChecklistProps {
  goalId: string;
  items: ChecklistItemRow[];
}

export function Checklist({ goalId, items }: ChecklistProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function handleToggle(item: ChecklistItemRow) {
    const fd = new FormData();
    fd.set('id', item.id);
    fd.set('goal_id', goalId);
    fd.set('done', String(item.done));
    try {
      await toggleChecklistItem(fd);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Failed to update' });
    }
  }

  async function handleAdd() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('goal_id', goalId);
      fd.set('title', t);
      await addChecklistItem(fd);
      setTitle('');
      setAddOpen(false);
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Failed to add item' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState
          icon={<CheckSquare />}
          title="No checklist yet"
          description="Break this goal down into small, checkable steps."
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 rounded-sm',
                'hover:bg-surface-elevated/60',
              )}
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={() => void handleToggle(item)}
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
              if (e.key === 'Escape') {
                setAddOpen(false);
                setTitle('');
              }
            }}
            placeholder="New checklist item"
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
          Add checklist item
        </Button>
      )}
    </div>
  );
}
