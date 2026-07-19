'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type * as React from 'react';

export interface SidebarNavLinkProps {
  href: string;
  /**
   * If true, only an exact pathname match counts as active. Use for "/" so the
   * Dashboard link doesn't light up on every page.
   */
  exact?: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  className?: string;
}

export function SidebarNavLink({
  href,
  exact = false,
  icon,
  label,
  badge,
  className,
}: SidebarNavLinkProps) {
  const pathname = usePathname() ?? '/';
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'bg-accent/15 text-text-primary font-medium'
          : 'text-text-muted hover:bg-surface-elevated/60 hover:text-text-primary',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex size-4 shrink-0 items-center',
          active ? 'text-accent' : 'text-text-muted group-hover:text-text-primary',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge !== 0 && badge !== '0' && (
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5',
            'text-2xs font-medium',
            active
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-elevated text-text-muted group-hover:bg-surface group-hover:text-text-primary',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
