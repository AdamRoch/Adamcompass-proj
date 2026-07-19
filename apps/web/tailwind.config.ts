import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './components/**/*.{ts,tsx,mdx}', './lib/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--color-background) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'hsl(var(--color-surface-elevated) / <alpha-value>)',
        border: 'hsl(var(--color-border) / <alpha-value>)',
        'border-strong': 'hsl(var(--color-border) / <alpha-value>)',
        'text-primary': 'hsl(var(--color-text-primary) / <alpha-value>)',
        'text-muted': 'hsl(var(--color-text-muted) / <alpha-value>)',
        'text-subtle': 'hsl(var(--color-text-subtle) / <alpha-value>)',
        accent: 'hsl(var(--color-accent) / <alpha-value>)',
        'accent-hover': 'hsl(var(--color-accent-hover) / <alpha-value>)',
        'accent-fg': 'hsl(var(--color-accent-fg) / <alpha-value>)',
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        danger: 'hsl(var(--color-danger) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--color-border) / <alpha-value>)',
      },
      ringColor: {
        DEFAULT: 'hsl(var(--color-focus-ring) / <alpha-value>)',
      },
      ringOffsetColor: {
        DEFAULT: 'hsl(var(--color-background) / <alpha-value>)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      keyframes: {
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'overlay-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.96)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'dialog-out': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.96)' },
        },
        'popover-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'popover-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.96)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-out': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(100%)' },
        },
      },
      animation: {
        'skeleton-shimmer': 'skeleton-shimmer 1400ms ease-in-out infinite',
        'overlay-in': 'overlay-in 160ms ease-out',
        'overlay-out': 'overlay-out 120ms ease-in',
        'dialog-in': 'dialog-in 220ms cubic-bezier(0.25, 1, 0.5, 1)',
        'dialog-out': 'dialog-out 160ms cubic-bezier(0.5, 0, 0.75, 0)',
        'popover-in': 'popover-in 140ms cubic-bezier(0.25, 1, 0.5, 1)',
        'popover-out': 'popover-out 100ms ease-in',
        'toast-in': 'toast-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'toast-out': 'toast-out 180ms ease-in',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glass: 'var(--shadow-glass)',
      },
      backdropBlur: {
        glass: 'var(--blur-glass)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter Display', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
