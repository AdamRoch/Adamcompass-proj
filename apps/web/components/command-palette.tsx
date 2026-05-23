'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  BookOpen,
  FileText,
  Folder,
  Home,
  Inbox,
  LogOut,
  Palette,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react';
import type { EntityType } from '@compass/shared';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { cn } from '@/lib/cn';

interface SearchHit {
  entity_type: EntityType;
  entity_id: string;
  title: string;
  snippet: string;
  rank: number;
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  project: <Folder className="size-4" aria-hidden />,
  learning_goal: <Target className="size-4" aria-hidden />,
  resource: <BookOpen className="size-4" aria-hidden />,
  note: <FileText className="size-4" aria-hidden />,
};

const ENTITY_HREFS: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  learning_goal: (id) => `/learning/${id}`,
  resource: (id) => `/learning/reading?resource=${id}`,
  note: (id) => `/inbox?note=${id}`,
};

const ENTITY_LABELS: Record<string, string> = {
  project: 'PROJECT',
  learning_goal: 'GOAL',
  resource: 'RESOURCE',
  note: 'NOTE',
};

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Inbox count rendered as a trailing badge on the Inbox nav row. */
  inboxCount?: number;
}

export function CommandPalette({ open, onOpenChange, inboxCount }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
      setThemeOpen(false);
    }
  }, [open]);

  // Debounced search
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const url = `/api/v1/search?q=${encodeURIComponent(q)}&limit=8`;
        const res = await fetch(url, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!res.ok) {
          setHits([]);
        } else {
          const data = (await res.json()) as { hits: SearchHit[] };
          setHits(data.hits ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setHits([]);
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function dispatch(name: string) {
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent(name));
  }

  async function signOut() {
    onOpenChange(false);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
    } catch {}
    router.refresh();
    router.push('/login');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'left-1/2 top-[15%] w-[640px] max-w-[calc(100vw-2rem)]',
          '-translate-x-1/2 translate-y-0 p-0',
          'rounded-xl',
        )}
        hideClose
        aria-label="Command palette"
      >
        <Command label="Command palette" className="flex w-full flex-col" loop>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="size-4 text-text-muted" aria-hidden />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search Compass or run a command..."
              className={cn(
                'flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted',
                'outline-none',
              )}
            />
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
              {searching ? 'Searching...' : 'No results.'}
            </Command.Empty>

            <Command.Group
              heading="Navigate"
              className={cn(
                'mb-1 text-2xs font-medium uppercase tracking-wider text-text-muted',
                '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
              )}
            >
              <PaletteRow
                icon={<Home className="size-4" aria-hidden />}
                label="Dashboard"
                shortcut="g d"
                onSelect={() => go('/')}
              />
              <PaletteRow
                icon={<Inbox className="size-4" aria-hidden />}
                label="Inbox"
                badge={inboxCount && inboxCount > 0 ? inboxCount.toString() : undefined}
                shortcut="g i"
                onSelect={() => go('/inbox')}
              />
              <PaletteRow
                icon={<Folder className="size-4" aria-hidden />}
                label="Projects"
                shortcut="g p"
                onSelect={() => go('/projects')}
              />
              <PaletteRow
                icon={<Target className="size-4" aria-hidden />}
                label="Learning"
                shortcut="g l"
                onSelect={() => go('/learning')}
              />
              <PaletteRow
                icon={<Settings className="size-4" aria-hidden />}
                label="Settings"
                shortcut="g s"
                onSelect={() => go('/settings')}
              />
            </Command.Group>

            <Command.Group
              heading="Actions"
              className={cn(
                'mb-1 text-2xs font-medium uppercase tracking-wider text-text-muted',
                '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
              )}
            >
              <PaletteRow
                icon={<Plus className="size-4" aria-hidden />}
                label="New project"
                onSelect={() => go('/projects?new=1')}
              />
              <PaletteRow
                icon={<Sparkles className="size-4" aria-hidden />}
                label="New learning goal"
                onSelect={() => go('/learning?new=1')}
              />
              <PaletteRow
                icon={<Plus className="size-4" aria-hidden />}
                label="New capture"
                shortcut="⌘N"
                onSelect={() => dispatch('compass:open-capture')}
              />
              <PaletteRow
                icon={<Palette className="size-4" aria-hidden />}
                label="Toggle theme"
                onSelect={() => setThemeOpen(true)}
              />
              <PaletteRow
                icon={<LogOut className="size-4" aria-hidden />}
                label="Sign out"
                onSelect={signOut}
              />
            </Command.Group>

            {hits.length > 0 && (
              <Command.Group
                heading={`Search results${query ? `: "${query}"` : ''}`}
                className={cn(
                  'mb-1 text-2xs font-medium uppercase tracking-wider text-text-muted',
                  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
                )}
              >
                {hits.map((hit) => {
                  const Icon = ENTITY_ICONS[hit.entity_type] ?? (
                    <FileText className="size-4" aria-hidden />
                  );
                  const hrefFn = ENTITY_HREFS[hit.entity_type];
                  const href = hrefFn ? hrefFn(hit.entity_id) : '/';
                  const label = ENTITY_LABELS[hit.entity_type] ?? hit.entity_type.toUpperCase();
                  return (
                    <PaletteRow
                      key={`${hit.entity_type}:${hit.entity_id}`}
                      icon={Icon}
                      label={hit.title || hit.snippet || '(untitled)'}
                      badge={label}
                      onSelect={() => go(href)}
                    />
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t px-4 py-2 text-2xs text-text-muted">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate{'  '}
              <kbd className="font-mono">⏎</kbd> open{'  '}
              <kbd className="font-mono">esc</kbd> close
            </span>
          </div>
        </Command>

        {themeOpen && (
          <div className="border-t p-3">
            <ThemeSwitcher
              onChange={() => {
                setThemeOpen(false);
                onOpenChange(false);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PaletteRowProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  shortcut?: string;
  onSelect: () => void;
}

function PaletteRow({ icon, label, badge, shortcut, onSelect }: PaletteRowProps) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm',
        'text-text-primary',
        'aria-selected:bg-accent/15 aria-selected:text-text-primary',
        '[&_svg]:text-text-muted aria-selected:[&_svg]:text-accent',
      )}
    >
      <span className="inline-flex shrink-0 items-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-sm bg-surface-elevated px-1.5 py-0.5 text-2xs text-text-muted">
          {badge}
        </span>
      )}
      {shortcut && (
        <span className="font-mono text-2xs text-text-muted">{shortcut}</span>
      )}
    </Command.Item>
  );
}

/**
 * Wires up the global ⌘K keybinding and renders the palette. Mount once,
 * near the top of the app shell.
 */
export function CommandPaletteMount({ inboxCount }: { inboxCount?: number }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape' && open) {
        // Dialog onOpenChange already covers this — left as a safety net
        // for cases where focus has escaped the dialog.
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Expose a way for other UI (e.g. TopCaptureBar's ⌘K button) to open
  // the palette without prop-drilling.
  React.useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('compass:open-palette', onOpen);
    return () => window.removeEventListener('compass:open-palette', onOpen);
  }, []);

  return <CommandPalette open={open} onOpenChange={setOpen} inboxCount={inboxCount} />;
}
