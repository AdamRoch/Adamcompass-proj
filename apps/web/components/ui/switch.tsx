'use client';

import { cn } from '@/lib/cn';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...rest }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full',
        'border border-border bg-surface-elevated',
        'transition-colors duration-150 ease',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm',
          'translate-x-[2px] transition-transform duration-150 ease',
          'data-[state=checked]:translate-x-[14px]',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
