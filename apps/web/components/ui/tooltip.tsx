'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs',
          'rounded-md border border-border/80 bg-surface-elevated/95 backdrop-blur-sm',
          'px-2 py-1 text-xs text-text-primary shadow-md',
          'data-[state=delayed-open]:animate-popover-in',
          'data-[state=closed]:animate-popover-out',
          'origin-[var(--radix-tooltip-content-transform-origin)]',
          className,
        )}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
});

/**
 * Simple all-in-one helper: <SimpleTooltip content="hi"><button>x</button></SimpleTooltip>.
 * Requires a TooltipProvider higher up the tree.
 */
export function SimpleTooltip({
  content,
  children,
  delayDuration = 400,
  side,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  delayDuration?: number;
  side?: TooltipPrimitive.TooltipContentProps['side'];
}) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}
