'use client';

import * as React from 'react';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';

/**
 * Tiny client wrapper around the global ThemeSwitcher so the Settings page can
 * stay a server component while still rendering the theme picker inline.
 *
 * The `value` is typed as a plain string (rather than `Theme`) so this island
 * doesn't drag `@compass/shared`'s barrel into the client bundle traversal.
 */
export function ThemePicker({ value }: { value: string }) {
  // Cast back to the Theme union expected by ThemeSwitcher.
  return <ThemeSwitcher value={value as Parameters<typeof ThemeSwitcher>[0]['value']} showLabel />;
}
