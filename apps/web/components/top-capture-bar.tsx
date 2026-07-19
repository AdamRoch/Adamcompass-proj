'use client';

import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { Command, Plus, Search } from 'lucide-react';
import * as React from 'react';

const CLIENT_ID_KEY = 'compass.client_id';

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback for older environments.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getClientId(): string {
  if (typeof window === 'undefined') return 'web-server';
  try {
    let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = uuid();
      window.sessionStorage.setItem(CLIENT_ID_KEY, id);
    }
    return `web-${id}`;
  } catch {
    return `web-${uuid()}`;
  }
}

export interface TopCaptureBarProps {
  /** Click handler from parent — opens the ⌘K palette. */
  onOpenPalette: () => void;
}

export function TopCaptureBar({ onOpenPalette }: TopCaptureBarProps) {
  const [value, setValue] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ⌘N anywhere on the page → dispatch the capture-modal open event.
  // ⌘K is handled at the CommandPalette level, but we also forward it from
  // the inline button.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      const k = e.key.toLowerCase();
      if (k === 'n') {
        // Avoid hijacking when user is typing in an input/textarea
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
          // Still allow ⌘N globally — capture modal is the intent.
        }
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('compass:open-capture'));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = value.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    const idemKey = uuid();
    const clientId = getClientId();
    try {
      const res = await fetch('/api/v1/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          idem_key: idemKey,
          client_id: clientId,
          body,
          type_hint: 'unspecified',
          tags: [],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Capture failed',
          description: text || `Server responded ${res.status}`,
        });
      } else {
        toast({
          variant: 'success',
          title: 'Captured',
          description: 'Lands in Inbox.',
        });
        setValue('');
      }
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Capture failed',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex w-full items-center gap-2')}
      // biome-ignore lint/a11y/useSemanticElements: role="search" on the form is the established landmark pattern here
      role="search"
      aria-label="Quick capture"
    >
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Capture an idea, note, or topic..."
        leftIcon={<Plus className="size-4" aria-hidden />}
        disabled={submitting}
        aria-label="Quick capture input"
        wrapperClassName="flex-1"
      />
      <button
        type="button"
        onClick={onOpenPalette}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-md border px-2.5',
          'surface-glass text-text-muted hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'transition-colors',
        )}
        aria-label="Open command palette"
      >
        <Search className="size-3.5" aria-hidden />
        <Kbd>
          <Command className="size-3" aria-hidden />K
        </Kbd>
      </button>
    </form>
  );
}
