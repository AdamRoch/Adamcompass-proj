'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

export interface TitleEditProps {
  /** API path entity: `projects` or `learning-goals`. */
  entity: 'projects' | 'learning-goals';
  id: string;
  initial: string;
}

/**
 * Click-to-edit title. Blur or Enter saves via PATCH. Esc cancels.
 */
export function TitleEdit({ entity, id, initial }: TitleEditProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const next = value.trim();
    if (!next || next === initial) {
      setEditing(false);
      setValue(initial);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/${entity}/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Failed to save title',
          description: text || `Server responded ${res.status}`,
        });
        setValue(initial);
      } else {
        toast({ variant: 'success', title: 'Title updated' });
        router.refresh();
      }
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Failed to save title',
        description: err instanceof Error ? err.message : 'Network error',
      });
      setValue(initial);
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void save();
          } else if (e.key === 'Escape') {
            setValue(initial);
            setEditing(false);
          }
        }}
        disabled={busy}
        className={cn(
          'font-display text-3xl font-semibold tracking-tight text-text-primary',
          'bg-transparent outline-none border-b border-accent/40 focus:border-accent',
          'w-full',
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'group block w-full text-left',
        'font-display text-3xl font-semibold tracking-tight text-text-primary',
        'rounded-sm px-0 py-0',
        'hover:text-text-primary focus:outline-none',
      )}
      title="Click to edit"
    >
      <span className="border-b border-transparent group-hover:border-border-strong/60">
        {value}
      </span>
    </button>
  );
}
