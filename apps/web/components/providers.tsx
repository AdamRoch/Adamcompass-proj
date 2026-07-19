'use client';

import { Toaster } from '@/components/ui/toast';
import type { Theme } from '@compass/shared';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as React from 'react';

interface ProvidersProps {
  /**
   * Initial theme already applied to <html data-theme> by the server layout.
   * Passed in so the ThemeBoot can reconcile after mount (e.g. localStorage drift).
   */
  initialTheme: Theme;
  children: React.ReactNode;
}

/**
 * ThemeBoot ensures the <html data-theme> attribute matches the user's persisted
 * choice on mount. Server-side, root layout already sets it from `getSettings()`,
 * but if the user changed theme in a sibling tab (and we stashed in localStorage),
 * we reconcile here without blocking first paint.
 */
function ThemeBoot({ initialTheme }: { initialTheme: Theme }) {
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem('compass.theme');
      const current = document.documentElement.getAttribute('data-theme');
      if (stored && stored !== current) {
        document.documentElement.setAttribute('data-theme', stored);
      } else if (!stored && current !== initialTheme) {
        document.documentElement.setAttribute('data-theme', initialTheme);
      }
    } catch {
      // localStorage may throw in private mode; safe to ignore
    }
  }, [initialTheme]);
  return null;
}

export function Providers({ initialTheme, children }: ProvidersProps) {
  return (
    <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
      <ThemeBoot initialTheme={initialTheme} />
      {children}
      <Toaster />
    </Tooltip.Provider>
  );
}
