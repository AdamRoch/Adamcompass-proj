'use client';

import * as React from 'react';
import { Moon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SimpleTooltip } from './tooltip';

export interface SnoozeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** ISO timestamp or human-readable "until" target. */
  until: string;
  /** Optional reason — full text rendered in a tooltip; chip truncates at 36 chars. */
  reason?: string;
}

/** Format an ISO timestamp into a compact weekday like "Wed" or "May 24". */
function formatUntil(until: string): string {
  // Pass-through if it's already a short label (e.g. "Wed", "Mon")
  if (until.length <= 6 && !until.includes('-') && !until.includes(':')) return until;
  const d = new Date(until);
  if (Number.isNaN(d.valueOf())) return until;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const within7 =
    Math.abs(d.getTime() - now.getTime()) <= 1000 * 60 * 60 * 24 * 7 && d > now;
  if (within7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, Math.max(0, n - 1))}…`;
}

export function SnoozeBadge({ until, reason, className, ...rest }: SnoozeBadgeProps) {
  const label = formatUntil(until);
  const truncatedReason = reason ? truncate(reason, 36) : undefined;
  const fullText = reason ? `Snoozed until ${label} · ${reason}` : `Snoozed until ${label}`;

  const chip = (
    <span
      title={truncatedReason ? undefined : fullText}
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-sm px-1.5',
        'bg-accent/10 text-accent',
        'text-2xs font-semibold tracking-[0.03em]',
        className,
      )}
      {...rest}
    >
      <Moon className="size-2.5" aria-hidden />
      <span className="max-w-[120px] truncate">
        {label}
        {truncatedReason ? <span className="font-normal text-text-muted"> · {truncatedReason}</span> : null}
      </span>
    </span>
  );

  // Only wrap in a tooltip when the reason was actually truncated (or has any non-trivial content)
  if (reason && reason.length > 36) {
    return <SimpleTooltip content={fullText}>{chip}</SimpleTooltip>;
  }
  return chip;
}
