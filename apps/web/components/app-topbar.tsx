'use client';

import { CommandPaletteMount } from '@/components/command-palette';
import { TopCaptureBar } from '@/components/top-capture-bar';
import { cn } from '@/lib/cn';
import * as React from 'react';

export interface AppTopbarProps {
  inboxCount?: number;
  right?: React.ReactNode;
}

/**
 * Sticky top bar that hosts the quick-capture input + ⌘K palette trigger.
 * Renders the `CommandPaletteMount` as a sibling so the global ⌘K keybinding
 * is always active while this bar is on screen.
 */
export function AppTopbar({ inboxCount, right }: AppTopbarProps) {
  const openPalette = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('compass:open-palette'));
  }, []);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-20 flex h-14 items-center gap-3 px-4',
          'border-b',
          'surface-glass rounded-none',
        )}
      >
        <div className="flex flex-1 items-center gap-2">
          <TopCaptureBar onOpenPalette={openPalette} />
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </header>
      <CommandPaletteMount inboxCount={inboxCount} />
    </>
  );
}
