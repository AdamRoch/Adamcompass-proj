import * as React from 'react';
import { cn } from '@/lib/cn';

export type SkeletonVariant = 'line' | 'rect' | 'circle';

export interface SkeletonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: SkeletonVariant;
  /** Numeric pixels or any CSS width string. */
  width?: number | string;
  /** Numeric pixels or any CSS height string. */
  height?: number | string;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  line: 'rounded-sm h-3',
  rect: 'rounded-md',
  circle: 'rounded-full',
};

function asSize(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'number' ? `${v}px` : v;
}

export function Skeleton({
  className,
  variant = 'line',
  width,
  height,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      data-skeleton
      className={cn(
        'block bg-[linear-gradient(90deg,hsl(var(--color-surface-elevated)/0.6),hsl(var(--color-border)/0.8),hsl(var(--color-surface-elevated)/0.6))]',
        'bg-[length:200%_100%]',
        'motion-safe:animate-skeleton-shimmer motion-reduce:animate-pulse',
        VARIANT_CLASSES[variant],
        className,
      )}
      style={{
        width: asSize(width) ?? (variant === 'circle' ? '32px' : '100%'),
        height: asSize(height) ?? (variant === 'circle' ? '32px' : undefined),
        ...style,
      }}
      {...rest}
    />
  );
}

/**
 * Convenience stack of `count` line skeletons of decreasing width — useful as
 * a placeholder for paragraph content.
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
