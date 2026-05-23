'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Tiny inline Slot — clones the only child and merges className/ref/handlers.
 * Kept inline because `@radix-ui/react-slot` is not in this app's package.json
 * (the constraint allows only the specific Radix packages already declared).
 */
const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  function Slot({ children, ...slotProps }, forwardedRef) {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props;

    // Merge className, refs, and event handlers.
    const mergedClassName = [slotProps.className, childProps.className as string | undefined]
      .filter(Boolean)
      .join(' ');

    const mergedProps: Record<string, unknown> = { ...slotProps, ...childProps };
    if (mergedClassName) mergedProps.className = mergedClassName;

    // Merge event handlers (slot handlers run, then child handlers).
    for (const key of Object.keys(slotProps)) {
      if (/^on[A-Z]/.test(key) && typeof childProps[key] === 'function') {
        const slotHandler = (slotProps as Record<string, unknown>)[key] as
          | ((...args: unknown[]) => unknown)
          | undefined;
        const childHandler = childProps[key] as (...args: unknown[]) => unknown;
        mergedProps[key] = (...args: unknown[]) => {
          slotHandler?.(...args);
          return childHandler(...args);
        };
      }
    }

    // Forward ref to the cloned child.
    (mergedProps as { ref?: React.Ref<unknown> }).ref = forwardedRef as React.Ref<unknown>;

    return React.cloneElement(child, mergedProps);
  },
);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: [
    'bg-accent text-accent-fg',
    'hover:bg-accent-hover',
    'border border-transparent',
    'shadow-sm',
    'disabled:bg-accent/60 disabled:text-accent-fg/70',
  ].join(' '),
  secondary: [
    'surface-glass',
    'text-text-primary',
    'hover:bg-surface-elevated/80',
    'disabled:opacity-60',
  ].join(' '),
  ghost: [
    'bg-transparent text-text-primary',
    'border border-transparent',
    'hover:bg-surface-elevated/60',
    'disabled:opacity-60',
  ].join(' '),
  destructive: [
    'bg-danger text-white',
    'hover:bg-danger/90',
    'border border-transparent',
    'shadow-sm',
    'disabled:bg-danger/60',
  ].join(' '),
  link: [
    'bg-transparent text-accent',
    'border border-transparent',
    'underline-offset-4 hover:underline',
    'disabled:opacity-60',
    'p-0 h-auto',
  ].join(' '),
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs rounded-sm gap-1.5',
  md: 'h-9 px-3.5 text-sm rounded-md gap-2',
  lg: 'h-11 px-5 text-md rounded-md gap-2',
  icon: 'h-9 w-9 p-0 rounded-md',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    asChild = false,
    disabled,
    children,
    type,
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  const isDisabled = disabled || loading;

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type ?? 'button'}
      disabled={isDisabled}
      data-loading={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center select-none whitespace-nowrap',
        'font-medium tracking-tight',
        'transition-[background-color,box-shadow,transform,opacity] duration-150 ease',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'active:scale-[0.97]',
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children ? <span className="inline-flex items-center">{children}</span> : null}
      {rightIcon && !loading ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </Comp>
  );
});
