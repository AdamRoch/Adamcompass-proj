import { SidebarNavLink } from '@/components/sidebar-nav-link';
import { cn } from '@/lib/cn';
import * as notesQ from '@compass/db/queries/notes';
import { Compass, Folder, Home, Inbox, Radio, Settings, StickyNote, Target } from 'lucide-react';
import Link from 'next/link';

/**
 * App sidebar — fixed-width left rail with brand, nav, and footer settings link.
 * Renders inbox count badge from `listInbox`. Server-rendered so the badge is
 * accurate on first paint; the active-link state is a small client island.
 */
export async function AppSidebar() {
  let inboxCount = 0;
  try {
    const inbox = await notesQ.listInbox(200);
    inboxCount = inbox.length;
  } catch {
    inboxCount = 0;
  }

  return (
    <aside
      className={cn(
        'sticky top-0 z-30 flex h-screen w-60 shrink-0 flex-col',
        'border-r p-3',
        'surface-glass rounded-none',
      )}
      aria-label="Primary"
    >
      {/* Brand */}
      <Link
        href="/"
        className={cn(
          'mb-4 flex items-center gap-2 px-2 py-2 rounded-md',
          'text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'hover:bg-surface-elevated/60',
        )}
        aria-label="Compass — home"
      >
        <Compass className="size-5 text-accent" aria-hidden />
        <span className="font-display text-lg font-semibold tracking-tight">Compass</span>
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Sections">
        <SidebarNavLink href="/" exact icon={<Home className="size-4" />} label="Dashboard" />
        <SidebarNavLink
          href="/inbox"
          icon={<Inbox className="size-4" />}
          label="Inbox"
          badge={inboxCount}
        />
        <SidebarNavLink href="/projects" icon={<Folder className="size-4" />} label="Projects" />
        <SidebarNavLink href="/learning" icon={<Target className="size-4" />} label="Learning" />
        <SidebarNavLink href="/notes" icon={<StickyNote className="size-4" />} label="Notes" />
        <SidebarNavLink href="/activity" icon={<Radio className="size-4" />} label="Activity" />
      </nav>

      {/* Footer */}
      <div className="mt-2 border-t pt-2">
        <SidebarNavLink href="/settings" icon={<Settings className="size-4" />} label="Settings" />
      </div>
    </aside>
  );
}

/**
 * Lightweight re-export of the inbox count for use in other server boundaries
 * (e.g. the command palette mount). Avoids duplicate DB hits if both are
 * rendered in the same request — Next dedupes identical query promises within
 * the same render pass, so calling `listInbox` again is cheap.
 */
export async function getInboxCount(): Promise<number> {
  try {
    const inbox = await notesQ.listInbox(200);
    return inbox.length;
  } catch {
    return 0;
  }
}
