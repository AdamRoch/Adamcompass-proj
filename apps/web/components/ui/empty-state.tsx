import * as React from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional icon node (e.g. a lucide icon). Rendered centered above title. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional action node (a Button typically). */
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-12 px-6',
        className,
      )}
      {...rest}
    >
      {icon ? (
        <div
          className={cn(
            'mb-3 inline-flex h-12 w-12 items-center justify-center',
            'rounded-full bg-surface-elevated text-text-muted',
            '[&_svg]:size-6',
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
