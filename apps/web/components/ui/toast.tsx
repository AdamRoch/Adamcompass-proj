'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

// ----------------------------------------------------------------------------
// Toast store (tiny, framework-free)
// ----------------------------------------------------------------------------

export type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'danger';

export interface ToastOptions {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss timeout in ms. Defaults to Radix viewport default (5000). */
  duration?: number;
  /** Optional action button on the right side. */
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends Required<Pick<ToastOptions, 'id' | 'variant'>> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
  action?: ToastOptions['action'];
  open: boolean;
}

type Listener = (toasts: ToastRecord[]) => void;

class ToastStore {
  private toasts: ToastRecord[] = [];
  private listeners = new Set<Listener>();

  getSnapshot = (): ToastRecord[] => this.toasts;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  push = (opts: ToastOptions): string => {
    const id = opts.id ?? `t_${Math.random().toString(36).slice(2, 10)}`;
    const record: ToastRecord = {
      id,
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? 'default',
      duration: opts.duration,
      action: opts.action,
      open: true,
    };
    this.toasts = [...this.toasts, record];
    this.emit();
    return id;
  };

  dismiss = (id: string) => {
    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, open: false } : t));
    this.emit();
  };

  remove = (id: string) => {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  };

  private emit() {
    for (const listener of this.listeners) listener(this.toasts);
  }
}

const store = new ToastStore();

export function toast(opts: ToastOptions): string {
  return store.push(opts);
}

export function useToast() {
  const subscribe = React.useCallback((cb: () => void) => store.subscribe(cb), []);
  const getSnapshot = React.useCallback(() => store.getSnapshot(), []);
  const toasts = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return React.useMemo(
    () => ({
      toasts,
      toast,
      dismiss: (id: string) => store.dismiss(id),
    }),
    [toasts],
  );
}

// ----------------------------------------------------------------------------
// Radix wrappers (styled)
// ----------------------------------------------------------------------------

export const ToastProviderPrimitive = ToastPrimitive.Provider;
export const ToastRoot = ToastPrimitive.Root;
export const ToastTitle = ToastPrimitive.Title;
export const ToastDescription = ToastPrimitive.Description;
export const ToastAction = ToastPrimitive.Action;
export const ToastClose = ToastPrimitive.Close;

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  default: 'before:bg-text-muted/60',
  success: 'before:bg-success',
  info: 'before:bg-accent',
  warning: 'before:bg-warning',
  danger: 'before:bg-danger',
};

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...rest }, ref) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 outline-none',
        'sm:bottom-4 sm:right-4 sm:top-auto sm:max-w-[420px]',
        className,
      )}
      {...rest}
    />
  );
});

/**
 * Mount this once near the app root (inside the (app) layout). Drives the toast store.
 *
 *   <Toaster />
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <ToastProviderPrimitive>
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open={t.open}
          duration={t.duration}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(t.id);
              // give Radix time to play exit animation before pruning
              window.setTimeout(() => store.remove(t.id), 250);
            }
          }}
          className={cn(
            'relative pl-4 pr-2 py-3 rounded-md',
            'surface-glass shadow-md',
            'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r',
            VARIANT_ACCENT[t.variant],
            'data-[state=open]:animate-toast-in',
            'data-[state=closed]:animate-toast-out',
            'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
            'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
            'data-[swipe=cancel]:transition-transform',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {t.title ? (
                <ToastPrimitive.Title className="text-sm font-medium text-text-primary">
                  {t.title}
                </ToastPrimitive.Title>
              ) : null}
              {t.description ? (
                <ToastPrimitive.Description
                  className={cn(
                    'text-xs text-text-muted',
                    t.title ? 'mt-0.5' : '',
                  )}
                >
                  {t.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            {t.action ? (
              <ToastPrimitive.Action
                altText={t.action.label}
                onClick={t.action.onClick}
                className={cn(
                  'shrink-0 rounded-sm px-2 py-1 text-xs font-medium text-accent',
                  'hover:bg-accent/10',
                )}
              >
                {t.action.label}
              </ToastPrimitive.Action>
            ) : null}
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className={cn(
                'shrink-0 self-start rounded-sm p-1 text-text-muted',
                'hover:bg-surface-elevated/70 hover:text-text-primary',
              )}
            >
              <X className="size-3.5" aria-hidden />
            </ToastPrimitive.Close>
          </div>
        </ToastPrimitive.Root>
      ))}
      <ToastViewport />
    </ToastProviderPrimitive>
  );
}
