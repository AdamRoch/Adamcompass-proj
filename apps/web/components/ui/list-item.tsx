'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ListItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Leading icon / glyph. */
  icon?: React.ReactNode;
  /** Primary title text (or arbitrary node). */
  title: React.ReactNode;
  /** Meta line below the title (timestamp, summary, etc.). */
  meta?: React.ReactNode;
  /** Right-aligned badge cluster (StagePill, StallBadge, TagChips, …). */
  badges?: React.ReactNode;
  /** Optional trailing chevron or icon button (e.g. DropdownMenu trigger). */
  trailing?: React.ReactNode;
  /** Currently selected row. */
  selected?: boolean;
  /** Snoozed row visual override (dimmed). */
  snoozed?: boolean;
  /** Dense (44px) variant. Default is comfortable (56px). */
  dense?: boolean;
  /** Render as a button (keyboard accessible). */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Optional href — when set, the row is rendered as a link. */
  href?: string;
}

export const ListItem = React.forwardRef<HTMLDivElement, ListItemProps>(function ListItem(
  {
    icon,
    title,
    meta,
    badges,
    trailing,
    selected = false,
    snoozed = false,
    dense = false,
    onClick,
    href,
    className,
    children,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const isInteractive = !!onClick || !!href;

  const content = (
    <>
      {selected ? (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-accent"
        />
      ) : null}
      {icon ? (
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 items-center justify-center text-text-muted',
            '[&_svg]:size-4',
            dense ? 'w-5' : 'w-6',
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-text-primary',
            dense ? 'text-sm' : 'text-sm font-medium',
          )}
        >
          {title}
        </div>
        {meta ? (
          <div className="truncate text-xs text-text-muted">{meta}</div>
        ) : null}
      </div>
      {badges ? (
        <div className="inline-flex shrink-0 items-center gap-1.5">{badges}</div>
      ) : null}
      {trailing ? (
        <div className="inline-flex shrink-0 items-center gap-1 text-text-muted">{trailing}</div>
      ) : null}
      {children}
    </>
  );

  const sharedClassName = cn(
    'group/listitem relative flex items-center gap-3 px-3',
    'rounded-md',
    'transition-[background-color,opacity,box-shadow] duration-150 ease',
    dense ? 'min-h-[44px] py-1.5' : 'min-h-[56px] py-2',
    isInteractive &&
      'cursor-pointer hover:bg-surface-elevated/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    selected && 'bg-accent/[0.08] hover:bg-accent/10',
    snoozed && 'opacity-60',
    className,
  );

  if (href) {
    return (
      <a
        ref={ref as unknown as React.Ref<HTMLAnchorElement>}
        href={href}
        data-selected={selected || undefined}
        data-snoozed={snoozed || undefined}
        className={sharedClassName}
        {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      ref={ref}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
        }
        onKeyDown?.(event);
      }}
      data-selected={selected || undefined}
      data-snoozed={snoozed || undefined}
      className={sharedClassName}
      {...rest}
    >
      {content}
    </div>
  );
});
