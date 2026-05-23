import * as React from 'react';
import { cn } from '@/lib/cn';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual size. Default `sm`. */
  size?: 'sm' | 'md';
}

export function Kbd({ className, size = 'sm', children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'font-mono font-medium text-text-muted',
        'rounded-sm border border-border/80 bg-surface/80',
        'shadow-[0_1px_0_hsl(var(--color-border)/0.8)]',
        size === 'sm' ? 'h-[18px] min-w-[18px] px-1 text-2xs' : 'h-5 min-w-[20px] px-1.5 text-xs',
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
