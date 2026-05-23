import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StallBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Number of days the entity has been stalled. */
  days: number;
  /** Override severity threshold. Default: amber if 1-7, red if >=8. */
  severity?: 'amber' | 'red';
}

export function StallBadge({ days, severity, className, ...rest }: StallBadgeProps) {
  const tone: 'amber' | 'red' = severity ?? (days >= 8 ? 'red' : 'amber');
  const isRed = tone === 'red';
  return (
    <span
      data-severity={tone}
      title={`Stalled ${days} day${days === 1 ? '' : 's'}`}
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-sm px-1.5',
        'text-2xs font-semibold uppercase tracking-[0.04em]',
        isRed ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning',
        className,
      )}
      {...rest}
    >
      {isRed ? (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-danger"
        />
      ) : (
        <Clock className="size-2.5" aria-hidden />
      )}
      <span>{days}d</span>
    </span>
  );
}
