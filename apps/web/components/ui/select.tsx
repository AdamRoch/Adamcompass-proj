'use client';

import { cn } from '@/lib/cn';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...rest }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-9 w-full items-center justify-between gap-2',
        'rounded-md border border-border bg-surface/60 backdrop-blur-sm',
        'px-3 text-sm text-text-primary',
        'transition-[box-shadow,border-color,background-color] duration-150 ease',
        'hover:border-border-strong/80',
        'focus:outline-none focus:border-accent focus:ring-2 focus:ring-offset-1 focus:ring-offset-background',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'data-[placeholder]:text-text-subtle',
        '[&>span]:line-clamp-1',
        className,
      )}
      {...rest}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(function SelectScrollUpButton({ className, ...rest }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-text-muted',
        className,
      )}
      {...rest}
    >
      <ChevronUp className="size-4" aria-hidden />
    </SelectPrimitive.ScrollUpButton>
  );
});

export const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(function SelectScrollDownButton({ className, ...rest }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-text-muted',
        className,
      )}
      {...rest}
    >
      <ChevronDown className="size-4" aria-hidden />
    </SelectPrimitive.ScrollDownButton>
  );
});

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...rest }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'surface-glass rounded-md shadow-md',
          'text-sm text-text-primary',
          'data-[state=open]:animate-popover-in',
          'data-[state=closed]:animate-popover-out',
          'origin-[var(--radix-select-content-transform-origin)]',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        {...rest}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)]')}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...rest }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted',
        className,
      )}
      {...rest}
    />
  );
});

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2',
        'rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none',
        'data-[highlighted]:bg-accent/15 data-[highlighted]:text-text-primary',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    >
      <span className="absolute left-1.5 inline-flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-accent" strokeWidth={2.5} aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...rest }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border/60', className)}
      {...rest}
    />
  );
});
