'use client';

import { cn } from '@/lib/cn';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('inline-flex items-center gap-1 border-b border-border', className)}
      {...rest}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative inline-flex items-center gap-2',
        'h-9 px-3 -mb-px',
        'text-sm font-medium text-text-muted',
        'border-b-2 border-transparent',
        'transition-[color,border-color] duration-200 ease',
        'hover:text-text-primary',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'data-[state=active]:text-text-primary data-[state=active]:border-accent',
        'disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
      {...rest}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className,
      )}
      {...rest}
    />
  );
});
