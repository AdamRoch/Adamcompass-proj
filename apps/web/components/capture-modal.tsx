'use client';

/**
 * Capture modal — global ⌘N quick-capture for the Compass web app.
 *
 * Source spec: design/02-implementation-reference.md §5.9 (Capture modal),
 * docs/Compass-Implementation-PRD.md §8.1 (web capture), §8.5 (type picker).
 *
 * Two integration shapes:
 *
 * 1. **Controlled** — pass `open` + `onOpenChange`. Use this if the host
 *    already owns the open/close state (e.g. the top-bar capture input that
 *    expands into the modal, or a custom trigger).
 *
 * 2. **Uncontrolled provider** — render `<CaptureProvider />` once near the
 *    app root (typically in `(app)/layout.tsx`). It mounts the modal in a
 *    portal, binds the global ⌘N / Ctrl+N hotkey, and also listens for a
 *    `CustomEvent('compass:open-capture')` so any other surface (top bar,
 *    command palette, mobile share target) can open it without prop drilling.
 *
 * Either mode listens for `compass:open-capture` from anywhere in the DOM,
 * so this component is the single source of truth for "open the capture UI".
 */

import * as React from 'react';
import { INBOX_TYPE_HINTS, type InboxTypeHint } from '@compass/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TagChip } from '@/components/ui/tag-chip';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { getClientId } from '@/lib/capture-client-id';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** DOM event name any caller can dispatch to open the modal. */
export const CAPTURE_OPEN_EVENT = 'compass:open-capture';

/** Optional detail payload for the open event — lets callers pre-seed fields. */
export interface CaptureOpenEventDetail {
  body?: string;
  type_hint?: InboxTypeHint;
  tags?: string[];
}

const TYPE_HINT_LABELS: Record<InboxTypeHint, string> = {
  idea: 'Idea',
  note: 'Note',
  curiosity: 'Curiosity',
  unspecified: 'Unfiled',
};

const TAG_MAX_LEN = 64;
const TAG_MAX_COUNT = 20;
const BODY_MAX_LEN = 50_000;

// ---------------------------------------------------------------------------
// Modal — controlled component
// ---------------------------------------------------------------------------

export interface CaptureModalProps {
  /** Controlled open state. Omit (with `onOpenChange`) to render in uncontrolled mode. */
  open?: boolean;
  /** Called whenever the modal wants to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Optional initial form values when the modal opens. */
  initialBody?: string;
  initialTypeHint?: InboxTypeHint;
  initialTags?: string[];
  /** Optional override of the View Inbox action target. Defaults to `/inbox`. */
  inboxHref?: string;
}

/**
 * The modal itself. Supports either controlled (`open` + `onOpenChange`) or
 * uncontrolled use (manages internal state, opens via `compass:open-capture`).
 */
export function CaptureModal({
  open: openProp,
  onOpenChange,
  initialBody = '',
  initialTypeHint = 'unspecified',
  initialTags = [],
  inboxHref = '/inbox',
}: CaptureModalProps) {
  const isControlled = openProp !== undefined;

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isControlled ? (openProp as boolean) : internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Form state
  const [body, setBody] = React.useState(initialBody);
  const [typeHint, setTypeHint] = React.useState<InboxTypeHint>(initialTypeHint);
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [tagDraft, setTagDraft] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const { toast } = useToast();

  // ----- Reset form on open -----
  // Only reset when transitioning closed → open, so typing isn't wiped mid-edit.
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (!prevOpenRef.current && open) {
      setBody(initialBody);
      setTypeHint(initialTypeHint);
      setTags(initialTags);
      setTagDraft('');
      setError(null);
      setSubmitting(false);
    }
    prevOpenRef.current = open;
  }, [open, initialBody, initialTypeHint, initialTags]);

  // ----- Autofocus the textarea on open -----
  // Radix focuses the first focusable element by default; we explicitly want
  // the body textarea so the user can start typing immediately.
  React.useEffect(() => {
    if (!open) return;
    // requestAnimationFrame so the dialog content is mounted + visible.
    const r = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      // Put caret at end if there is pre-seeded text.
      const el = textareaRef.current;
      if (el && el.value) {
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          // Some browsers throw on programmatic selection range — non-fatal.
        }
      }
    });
    return () => cancelAnimationFrame(r);
  }, [open]);

  // ----- Listen for global "open capture" events -----
  React.useEffect(() => {
    function handler(evt: Event) {
      const detail = (evt as CustomEvent<CaptureOpenEventDetail | undefined>).detail;
      if (detail) {
        if (typeof detail.body === 'string') setBody(detail.body);
        if (detail.type_hint && (INBOX_TYPE_HINTS as readonly string[]).includes(detail.type_hint)) {
          setTypeHint(detail.type_hint);
        }
        if (Array.isArray(detail.tags)) {
          setTags(detail.tags.filter((t) => typeof t === 'string' && t.length > 0).slice(0, TAG_MAX_COUNT));
        }
      }
      setOpen(true);
    }
    window.addEventListener(CAPTURE_OPEN_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(CAPTURE_OPEN_EVENT, handler as EventListener);
    };
  }, [setOpen]);

  // ----- Tag chip-input helpers -----
  const addTag = React.useCallback((raw: string) => {
    const cleaned = raw.trim().replace(/^#/, '').slice(0, TAG_MAX_LEN);
    if (!cleaned) return;
    setTags((prev) => {
      if (prev.length >= TAG_MAX_COUNT) return prev;
      if (prev.includes(cleaned)) return prev;
      return [...prev, cleaned];
    });
  }, []);

  const removeTagAt = React.useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagDraft.trim()) {
        addTag(tagDraft);
        setTagDraft('');
      }
      return;
    }
    if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      e.preventDefault();
      removeTagAt(tags.length - 1);
      return;
    }
  }

  function onTagBlur() {
    // Commit a half-typed tag on blur so it's not silently lost.
    if (tagDraft.trim()) {
      addTag(tagDraft);
      setTagDraft('');
    }
  }

  // ----- Submission -----
  const canSubmit = body.trim().length > 0 && !submitting;

  const submit = React.useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;

    // Commit any in-flight tag draft so a user who hit ⌘Enter while typing in
    // the tag field still gets that tag included.
    let finalTags = tags;
    if (tagDraft.trim()) {
      const cleaned = tagDraft.trim().replace(/^#/, '').slice(0, TAG_MAX_LEN);
      if (cleaned && !finalTags.includes(cleaned) && finalTags.length < TAG_MAX_COUNT) {
        finalTags = [...finalTags, cleaned];
      }
    }

    setSubmitting(true);
    setError(null);

    const idem_key = crypto.randomUUID();
    const client_id = getClientId();
    const captured_at = new Date().toISOString();

    try {
      const res = await fetch('/api/v1/captures', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idem_key,
          client_id,
          body: trimmed.slice(0, BODY_MAX_LEN),
          type_hint: typeHint,
          tags: finalTags,
          captured_at,
        }),
      });

      if (res.status === 201 || res.status === 200) {
        // Success — close + toast.
        setOpen(false);
        toast({
          variant: 'success',
          title: 'Captured → Inbox',
          action: {
            label: 'View Inbox',
            onClick: () => {
              window.location.assign(inboxHref);
            },
          },
        });
        return;
      }

      // Non-2xx — try to read an error message from the JSON body.
      let message = `Capture failed (${res.status})`;
      try {
        const data: unknown = await res.json();
        if (data && typeof data === 'object') {
          const errObj = (data as { error?: unknown }).error;
          if (errObj && typeof errObj === 'object') {
            const m = (errObj as { message?: unknown }).message;
            if (typeof m === 'string' && m.length > 0) message = m;
          } else if (typeof errObj === 'string') {
            message = errObj;
          }
        }
      } catch {
        // Body wasn't JSON — keep the generic status message.
      }
      setError(message);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [body, tags, tagDraft, typeHint, submitting, setOpen, toast, inboxHref]);

  // ----- Keyboard: ⌘Enter / Ctrl+Enter inside the modal submits -----
  function onContentKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
    // Esc is handled by Radix Dialog (it triggers onOpenChange(false)).
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[560px] p-0"
        onKeyDown={onContentKeyDown}
        onOpenAutoFocus={(e) => {
          // We focus the textarea ourselves (see effect above) so prevent
          // Radix's default first-focusable focus (which would land on the
          // first chip or close button).
          e.preventDefault();
        }}
      >
        <div className="px-5 pt-5">
          <DialogHeader>
            <DialogTitle>Capture</DialogTitle>
            <DialogDescription>
              Quickly capture an idea, note, or curiosity. Lands in Inbox.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pt-4 pb-2 space-y-3">
          {/* Type hint chip selector */}
          <div
            role="radiogroup"
            aria-label="Type"
            className="flex flex-wrap items-center gap-1.5"
          >
            {INBOX_TYPE_HINTS.map((hint) => {
              const active = hint === typeHint;
              return (
                <button
                  key={hint}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTypeHint(hint)}
                  className={cn(
                    'inline-flex h-[22px] items-center rounded-xs border px-2 text-2xs font-medium',
                    'transition-[background-color,border-color,color] duration-150 ease',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    active
                      ? 'bg-accent-soft border-accent/40 text-accent'
                      : 'bg-surface-sunken/80 border-border text-text-muted hover:text-text-primary hover:border-border-strong/80',
                  )}
                >
                  {TYPE_HINT_LABELS[hint]}
                </button>
              );
            })}
          </div>

          {/* Body textarea */}
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            minRows={3}
            maxRows={12}
            aria-label="Capture body"
            maxLength={BODY_MAX_LEN}
          />

          {/* Tag chip-input */}
          <div>
            <label
              htmlFor="capture-tag-input"
              className="mb-1 block text-2xs font-medium uppercase tracking-[0.05em] text-text-muted"
            >
              Tags
            </label>
            <div
              className={cn(
                'flex flex-wrap items-center gap-1.5 rounded-md border border-border',
                'bg-surface/60 backdrop-blur-sm px-2 py-1.5',
                'focus-within:border-accent focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-offset-background',
                'transition-[box-shadow,border-color,background-color] duration-150 ease',
              )}
              onClick={(e) => {
                // Clicking the chip rail focuses the input for fast adding.
                if (e.target === e.currentTarget) {
                  const el = document.getElementById('capture-tag-input') as HTMLInputElement | null;
                  el?.focus();
                }
              }}
            >
              {tags.map((tag, i) => (
                <TagChip
                  key={`${tag}-${i}`}
                  interactive
                  onClick={() => removeTagAt(i)}
                  title="Click to remove"
                  aria-label={`Remove tag ${tag}`}
                >
                  {tag}
                </TagChip>
              ))}
              <input
                id="capture-tag-input"
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={onTagBlur}
                placeholder={tags.length === 0 ? 'Add tags (Enter to add)' : ''}
                aria-label="Add a tag"
                maxLength={TAG_MAX_LEN}
                disabled={tags.length >= TAG_MAX_COUNT}
                className={cn(
                  'min-w-[8ch] flex-1 bg-transparent text-sm text-text-primary outline-none',
                  'placeholder:text-text-subtle',
                )}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 pb-5">
          {error ? (
            <p
              role="alert"
              className="mr-auto text-xs text-danger"
            >
              {error}
            </p>
          ) : (
            <p className="mr-auto text-xs text-text-subtle">
              Esc to cancel  &middot;  &#8984;&#8629; to capture
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            loading={submitting}
            disabled={!canSubmit}
          >
            Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Global provider — mounts the modal once + binds ⌘N / Ctrl+N
// ---------------------------------------------------------------------------

export interface CaptureProviderProps {
  /** Override the inbox link target used by the success toast's "View Inbox". */
  inboxHref?: string;
}

/**
 * Mount once near the app root. Binds the global ⌘N / Ctrl+N hotkey and hosts
 * a single <CaptureModal /> in a portal (Dialog already portals via DialogPortal).
 */
export function CaptureProvider({ inboxHref }: CaptureProviderProps = {}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Match `e.key === 'n'` (case-insensitive) with primary modifier only.
      // We intentionally do NOT trigger when alt/shift are held to avoid
      // hijacking accented-character composition or other system shortcuts.
      const primary = e.metaKey || e.ctrlKey;
      if (!primary) return;
      if (e.altKey || e.shiftKey) return;
      if (e.key !== 'n' && e.key !== 'N') return;

      // Don't override a browser-native "new window" only when the user is
      // actively editing — we deliberately want ⌘N to mean capture inside
      // the app regardless of focus. preventDefault swallows the browser's
      // default "new window" action.
      e.preventDefault();
      e.stopPropagation();
      // Fire the same event a top-bar button would fire, so any consumer can
      // hook in (e.g. analytics) without subscribing to a private channel.
      window.dispatchEvent(new CustomEvent(CAPTURE_OPEN_EVENT));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return <CaptureModal open={open} onOpenChange={setOpen} inboxHref={inboxHref} />;
}
