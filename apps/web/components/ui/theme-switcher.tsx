'use client';

import { cn } from '@/lib/cn';
import { THEMES, type Theme } from '@compass/shared';
import { Check, Palette } from 'lucide-react';
import * as React from 'react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

const THEME_LABELS: Record<Theme, string> = {
  white_minimal: 'White Minimal',
  dark_minimal: 'Dark Minimal',
  outer_space: 'Outer Space',
  white_sand: 'White Sand',
  dark_forest: 'Dark Forest',
};

/** Tiny preview swatch — uses each theme's own surface + accent tokens via inline data-theme. */
function ThemeSwatch({ theme }: { theme: Theme }) {
  return (
    <span
      data-theme={theme}
      aria-hidden
      className="inline-flex h-4 w-4 overflow-hidden rounded-full border border-border/70"
    >
      <span className="block h-full w-1/2 bg-background" />
      <span className="block h-full w-1/2 bg-accent" />
    </span>
  );
}

export interface ThemeSwitcherProps {
  /** Current active theme. Falls back to whatever data-theme is on <html>. */
  value?: Theme;
  /** Optional callback fired after the local swap + persistence call. */
  onChange?: (theme: Theme) => void;
  /** Override the persistence endpoint. Default `/api/v1/settings`. */
  endpoint?: string;
  /** Show the current theme label next to the icon. */
  showLabel?: boolean;
  className?: string;
}

export function ThemeSwitcher({
  value,
  onChange,
  endpoint = '/api/v1/settings',
  showLabel = false,
  className,
}: ThemeSwitcherProps) {
  const [active, setActive] = React.useState<Theme>(value ?? 'white_minimal');

  // On mount, read the actual document theme so the indicator matches reality.
  React.useEffect(() => {
    if (value) {
      setActive(value);
      return;
    }
    if (typeof document === 'undefined') return;
    const current = document.documentElement.dataset.theme as Theme | undefined;
    if (current && THEMES.includes(current)) {
      setActive(current);
    }
  }, [value]);

  const handleSelect = React.useCallback(
    async (next: Theme) => {
      if (next === active) return;
      setActive(next);
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = next;
      }
      onChange?.(next);

      // Fire-and-forget persistence. Errors are swallowed at this layer because
      // the optimistic local update is what the user actually sees.
      try {
        await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active_theme: next }),
          credentials: 'same-origin',
        });
      } catch {
        // Caller can subscribe via onChange if they need richer error handling.
      }
    },
    [active, endpoint, onChange],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? 'md' : 'icon'}
          aria-label="Switch theme"
          className={cn('text-text-muted hover:text-text-primary', className)}
          leftIcon={<Palette className="size-4" />}
        >
          {showLabel ? THEME_LABELS[active] : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((theme) => {
          const isActive = theme === active;
          return (
            <DropdownMenuItem
              key={theme}
              onSelect={(event) => {
                event.preventDefault();
                void handleSelect(theme);
              }}
              className="gap-2"
            >
              <ThemeSwatch theme={theme} />
              <span className="flex-1">{THEME_LABELS[theme]}</span>
              {isActive ? (
                <Check className="size-3.5 text-accent" strokeWidth={2.5} aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
