'use client';

import { cn } from '@/lib/cn';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...rest }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center',
        'rounded-sm border border-border-strong bg-surface/70',
        'transition-[background-color,border-color,box-shadow] duration-150 ease',
        'hover:border-accent/70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-accent-fg',
        'data-[state=indeterminate]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:text-accent-fg',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      <CheckboxPrimitive.Indicator className="inline-flex items-center justify-center">
        {rest.checked === 'indeterminate' ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
