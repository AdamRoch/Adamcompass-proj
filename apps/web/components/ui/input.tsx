'use client';

import { cn } from '@/lib/cn';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Leading icon node, rendered inside the input frame. */
  leftIcon?: React.ReactNode;
  /** Trailing slot — typically a `<Kbd>` shortcut hint or status icon. */
  rightSlot?: React.ReactNode;
  /** When true, paints a danger ring + border. */
  invalid?: boolean;
  /** Wrapper className (the visual frame). Use `inputClassName` for the bare input. */
  wrapperClassName?: string;
  /** className passed to the inner <input>. */
  inputClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    wrapperClassName,
    inputClassName,
    leftIcon,
    rightSlot,
    invalid = false,
    disabled,
    type = 'text',
    ...rest
  },
  ref,
) {
  return (
    <div
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      className={cn(
        'group/input relative flex h-9 w-full items-center gap-2',
        'rounded-md border border-border bg-surface/60 backdrop-blur-sm',
        'px-3 text-sm text-text-primary',
        'transition-[box-shadow,border-color,background-color] duration-150 ease',
        'focus-within:border-accent focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-offset-background',
        'hover:border-border-strong/80',
        'data-[invalid]:border-danger data-[invalid]:focus-within:ring-danger/40',
        'data-[disabled]:opacity-60 data-[disabled]:cursor-not-allowed',
        wrapperClassName,
        className,
      )}
    >
      {leftIcon ? (
        <span
          className="pointer-events-none inline-flex shrink-0 items-center text-text-muted [&_svg]:size-4"
          aria-hidden
        >
          {leftIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'min-w-0 flex-1 bg-transparent outline-none',
          'placeholder:text-text-subtle',
          'disabled:cursor-not-allowed',
          inputClassName,
        )}
        {...rest}
      />
      {rightSlot ? (
        <span className="inline-flex shrink-0 items-center text-text-muted">{rightSlot}</span>
      ) : null}
    </div>
  );
});
