'use client';

import { cn } from '@/lib/cn';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50',
        'bg-background/60 backdrop-blur-sm',
        'data-[state=open]:animate-overlay-in',
        'data-[state=closed]:animate-overlay-out',
        className,
      )}
      {...rest}
    />
  );
});

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Hide the default top-right close button. */
  hideClose?: boolean;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ className, children, hideClose = false, ...rest }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[92vw] max-w-[560px] max-h-[85vh] overflow-auto',
          'surface-glass rounded-xl shadow-lg',
          'p-5',
          'focus:outline-none',
          'data-[state=open]:animate-dialog-in',
          'data-[state=closed]:animate-dialog-out',
          className,
        )}
        {...rest}
      >
        {children}
        {!hideClose ? (
          <DialogPrimitive.Close
            aria-label="Close"
            className={cn(
              'absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md',
              'text-text-muted hover:bg-surface-elevated/70 hover:text-text-primary',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              'transition-colors duration-150 ease',
            )}
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 pr-8', className)} {...rest} />;
}

export function DialogFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-5 flex items-center justify-end gap-2', className)} {...rest} />;
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold tracking-tight text-text-primary', className)}
      {...rest}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-text-muted', className)}
      {...rest}
    />
  );
});
