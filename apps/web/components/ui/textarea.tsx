'use client';

import { cn } from '@/lib/cn';
import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, grows to fit content (height auto-adjusts on input). */
  autoResize?: boolean;
  /** Minimum visible rows. Default 2. */
  minRows?: number;
  /** Maximum rows before showing scroll. Default 12. */
  maxRows?: number;
  /** When true, paints a danger ring + border. */
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    autoResize = true,
    minRows = 2,
    maxRows = 12,
    invalid = false,
    onInput,
    rows,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Merge forwarded ref with our local ref.
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement, []);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    el.style.height = 'auto';
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight || '20') || 20;
    const max = lineHeight * maxRows;
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [autoResize, maxRows]);

  // Resize on mount and whenever the controlled value changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value/defaultValue are intentional triggers, not used inside
  React.useEffect(() => {
    resize();
  }, [resize, rest.value, rest.defaultValue]);

  return (
    <textarea
      ref={innerRef}
      rows={rows ?? minRows}
      data-invalid={invalid || undefined}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      className={cn(
        'block w-full resize-none rounded-md border border-border bg-surface/60 backdrop-blur-sm',
        'px-3 py-2 text-sm text-text-primary',
        'placeholder:text-text-subtle',
        'transition-[box-shadow,border-color,background-color] duration-150 ease',
        'focus:outline-none focus:border-accent focus:ring-2 focus:ring-offset-1 focus:ring-offset-background',
        'hover:border-border-strong/80',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'data-[invalid]:border-danger data-[invalid]:focus:ring-danger/40',
        className,
      )}
      {...rest}
    />
  );
});
