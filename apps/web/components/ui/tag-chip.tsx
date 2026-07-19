'use client';

import { cn } from '@/lib/cn';
import { X } from 'lucide-react';
import type * as React from 'react';

export interface TagChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  /** Tag label without leading `#`. If omitted, `children` is used as the label. */
  name?: string;
  /** When provided, renders a remove (×) button on the right. */
  onRemove?: () => void;
  /** Optional leading icon (e.g. Hash from lucide). */
  leadingIcon?: React.ReactNode;
  /** When true, renders with hover affordance + cursor. */
  interactive?: boolean;
  /** Click handler — auto-marks the chip as interactive. */
  onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

export function TagChip({
  name,
  onRemove,
  leadingIcon,
  interactive,
  onClick,
  className,
  children,
  ...rest
}: TagChipProps) {
  // Allow either `name` prop or `children` text for the label.
  const label = name ?? children;
  const isInteractive = interactive || !!onClick;
  return (
    <span
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex h-[22px] items-center gap-1',
        'rounded-sm border border-border/70 px-1.5',
        'text-2xs font-medium tracking-[0.01em] text-text-muted',
        'bg-surface/70 backdrop-blur-sm',
        'transition-colors duration-150 ease',
        isInteractive &&
          'cursor-pointer hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className,
      )}
      {...rest}
    >
      {leadingIcon ? (
        <span className="inline-flex shrink-0 items-center [&_svg]:size-2.5" aria-hidden>
          {leadingIcon}
        </span>
      ) : (
        <span aria-hidden className="text-text-subtle">
          #
        </span>
      )}
      <span className="max-w-[160px] truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove tag ${typeof label === 'string' ? label : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full',
            '-mr-0.5 ml-0.5 text-text-subtle hover:bg-border/70 hover:text-text-primary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          )}
        >
          <X className="size-2.5" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
