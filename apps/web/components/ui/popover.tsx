'use client';

import { cn } from '@/lib/cn';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, align = 'center', sideOffset = 6, ...rest }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-auto min-w-[180px] max-w-[320px]',
          'surface-glass rounded-md shadow-md',
          'p-2 text-sm text-text-primary',
          'focus:outline-none',
          'data-[state=open]:animate-popover-in',
          'data-[state=closed]:animate-popover-out',
          'origin-[var(--radix-popover-content-transform-origin)]',
          className,
        )}
        {...rest}
      />
    </PopoverPrimitive.Portal>
  );
});
