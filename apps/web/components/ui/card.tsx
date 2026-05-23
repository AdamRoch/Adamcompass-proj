import * as React from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'default' | 'glass' | 'bare';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-surface border border-border rounded-lg shadow-sm',
  glass: 'surface-glass',
  bare: 'bg-transparent',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  asChild?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'default', padding = 'md', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(VARIANT_CLASSES[variant], PADDING_CLASSES[padding], className)}
      {...rest}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between gap-3 pb-3', className)}
        {...rest}
      />
    );
  },
);

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...rest }, ref) {
  return (
    <h3
      ref={ref}
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.06em] text-text-muted',
        className,
      )}
      {...rest}
    />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...rest }, ref) {
  return <p ref={ref} className={cn('text-sm text-text-muted', className)} {...rest} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('text-sm', className)} {...rest} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-end gap-2 pt-3', className)}
        {...rest}
      />
    );
  },
);
