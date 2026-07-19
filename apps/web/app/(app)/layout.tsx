import { AppSidebar, getInboxCount } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';
import { Providers } from '@/components/providers';
import { SignOutButton } from '@/components/sign-out-button';
import { requireUserOrRedirect } from '@/lib/auth';
import * as settingsQ from '@compass/db/queries/settings';
import type * as React from 'react';

/**
 * App shell layout. Every page mounted under this group is auth-gated.
 *
 *   +---------+--------------------------------------------------+
 *   | Sidebar | TopBar (capture + ⌘K palette + sign out)        |
 *   |  240px  +--------------------------------------------------+
 *   |         |                                                  |
 *   |         |  <main>{children}</main>                         |
 *   |         |                                                  |
 *   +---------+--------------------------------------------------+
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth gate — every route under (app)/ requires a session.
  await requireUserOrRedirect();

  // Server-side data for the shell. Fall back to defaults so the shell still
  // renders if the DB is empty / a query fails mid-render.
  let theme: 'white_minimal' | 'dark_minimal' | 'outer_space' | 'white_sand' | 'dark_forest' =
    'white_minimal';
  try {
    const s = await settingsQ.getSettings();
    theme = s.active_theme;
  } catch {
    // pre-migration boot: stay on default
  }

  const inboxCount = await getInboxCount();

  return (
    <Providers initialTheme={theme}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <AppTopbar inboxCount={inboxCount} right={<SignOutButton variant="ghost" />} />
          <main className="flex-1 overflow-x-hidden px-6 py-6">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </Providers>
  );
}
