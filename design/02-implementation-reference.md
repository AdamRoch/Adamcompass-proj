# Compass — Implementation Reference (week-1 build sheet)

**Source spec:** `design/01-ui-themes-spec.md`
**Companion:** `docs/Compass-Implementation-PRD.md` §12 (UI architecture), §14 (Theming)
**Theme enum:** `packages/shared/src/types.ts` (`THEMES`)

Single-page, copy-pasteable reference for building the web UI. All values are real (HSL, px, ms). Where the source spec left gaps, an explicit **GAP** note proposes a value.

---

## 1. CSS variable token catalog (`apps/web/app/globals.css`)

All themes share variable names; only values differ. Theme switching = `document.documentElement.setAttribute('data-theme', '...')`. Token swap is instant on `:root`; only the ambient layer cross-fades (320ms).

### 1.1 Shared (theme-agnostic) tokens — declared on `:root`

```css
:root {
  /* radii */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-2xl: 28px;
  --radius-full: 9999px;

  /* blur tokens (raw radius values; full filter strings below per-theme) */
  --blur-sm: 8px;
  --blur-md: 16px;
  --blur-lg: 24px;
  --blur-xl: 40px;

  /* motion easing */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-quart: cubic-bezier(0.5, 0, 0.75, 0);
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* motion durations */
  --dur-hover: 120ms;
  --dur-focus: 100ms;
  --dur-press: 60ms;
  --dur-popover-in: 140ms;
  --dur-popover-out: 100ms;
  --dur-dialog-in: 220ms;
  --dur-dialog-out: 160ms;
  --dur-sheet: 280ms;
  --dur-toast-in: 260ms;
  --dur-toast-out: 180ms;
  --dur-list-reorder: 240ms;
  --dur-tabs-underline: 200ms;
  --dur-theme-ambient: 320ms;
  --dur-skeleton: 1400ms;

  /* density multiplier (Settings → Appearance) */
  --density: 1; /* comfortable 1.15, compact 1.0, dense 0.9 */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-hover: 80ms; --dur-focus: 80ms; --dur-popover-in: 80ms;
    --dur-popover-out: 80ms; --dur-dialog-in: 80ms; --dur-dialog-out: 80ms;
    --dur-sheet: 80ms; --dur-toast-in: 80ms; --dur-toast-out: 80ms;
    --dur-list-reorder: 80ms; --dur-tabs-underline: 80ms;
    --dur-theme-ambient: 0ms;
  }
}
```

### 1.2 `white_minimal` (default)

```css
:root[data-theme="white_minimal"] {
  --bg: 220 14% 98%;
  --bg-ambient: 220 24% 96%;
  --surface: 0 0% 100%;
  --surface-elevated: 0 0% 100%;
  --surface-sunken: 220 14% 95%;

  --border: 220 14% 90%;
  --border-strong: 220 12% 82%;

  --text-primary: 220 18% 14%;
  --text-muted: 220 10% 46%;
  --text-faint: 220 8% 64%;

  --accent: 217 92% 52%;
  --accent-hover: 217 92% 46%;
  --accent-soft: 217 92% 94%;
  --accent-fg: 0 0% 100%;            /* text on accent fill */

  --success: 152 60% 42%;
  --warning: 38 92% 52%;
  --danger:  0 72% 52%;

  --focus-ring: 217 92% 52%;
  --focus-ring-alpha: 0.4;

  /* glass material */
  --glass-alpha: 0.72;
  --glass-blur-filter: blur(20px) saturate(1.4);
  --glass-border-alpha: 0.6;
  --glass-inner-highlight: inset 0 1px 0 hsl(0 0% 100% / 0.8);
  --glass-outer-shadow:
    0 1px 2px hsl(220 12% 20% / 0.04),
    0 8px 24px hsl(220 12% 20% / 0.06);

  /* elevation (light) */
  --elev-1: 0 1px 2px hsl(220 12% 20% / 0.04);
  --elev-2: 0 2px 4px hsl(220 12% 20% / 0.05), 0 4px 12px hsl(220 12% 20% / 0.05);
  --elev-3: 0 1px 2px hsl(220 12% 20% / 0.04), 0 8px 24px hsl(220 12% 20% / 0.06);
  --elev-4: 0 4px 8px hsl(220 12% 20% / 0.06), 0 24px 48px hsl(220 12% 20% / 0.12);

  /* dialog overlay */
  --overlay: 220 18% 14%;
  --overlay-alpha: 0.25;
}
```

### 1.3 `dark_minimal`

```css
:root[data-theme="dark_minimal"] {
  --bg: 222 18% 8%;
  --bg-ambient: 222 22% 6%;
  --surface: 222 14% 12%;
  --surface-elevated: 222 14% 14%;
  --surface-sunken: 222 16% 10%;

  --border: 222 12% 22%;
  --border-strong: 222 12% 32%;

  --text-primary: 220 14% 92%;
  --text-muted: 220 8% 64%;
  --text-faint: 220 6% 46%;

  --accent: 200 90% 62%;
  --accent-hover: 200 90% 70%;
  --accent-soft: 200 60% 18%;
  --accent-fg: 222 30% 8%;           /* dark text on bright sky accent */

  --success: 152 50% 52%;
  --warning: 38 86% 58%;
  --danger:  0 68% 60%;

  --focus-ring: 200 90% 62%;
  --focus-ring-alpha: 0.5;

  --glass-alpha: 0.58;
  --glass-blur-filter: blur(22px) saturate(1.2);
  --glass-border-alpha: 0.06;        /* white border */
  --glass-inner-highlight: inset 0 1px 0 hsl(0 0% 100% / 0.05);
  --glass-outer-shadow:
    0 1px 2px hsl(0 0% 0% / 0.4),
    0 12px 32px hsl(0 0% 0% / 0.35);

  --elev-1: 0 1px 2px hsl(0 0% 0% / 0.3);
  --elev-2: 0 2px 4px hsl(0 0% 0% / 0.35), 0 6px 16px hsl(0 0% 0% / 0.35);
  --elev-3: 0 1px 2px hsl(0 0% 0% / 0.4), 0 12px 32px hsl(0 0% 0% / 0.4);
  --elev-4: 0 4px 8px hsl(0 0% 0% / 0.45), 0 28px 56px hsl(0 0% 0% / 0.55);

  --overlay: 0 0% 0%;
  --overlay-alpha: 0.4;
}
```

### 1.4 `outer_space`

```css
:root[data-theme="outer_space"] {
  --bg: 245 38% 7%;
  --bg-ambient: 260 50% 5%;
  --surface: 245 28% 13%;
  --surface-elevated: 245 26% 16%;
  --surface-sunken: 245 32% 10%;

  --border: 245 20% 28%;
  --border-strong: 260 24% 38%;

  --text-primary: 250 30% 94%;
  --text-muted: 250 18% 70%;
  --text-faint: 250 12% 52%;

  --accent: 280 80% 68%;
  --accent-hover: 280 84% 76%;
  --accent-soft: 280 50% 20%;
  --accent-fg: 260 40% 10%;

  --success: 162 60% 58%;
  --warning: 38 88% 62%;
  --danger:  350 78% 62%;

  --focus-ring: 280 80% 68%;
  --focus-ring-alpha: 0.55;

  --glass-alpha: 0.52;
  --glass-blur-filter: blur(28px) saturate(1.5);
  /* GAP: spec uses violet-tinted border, not the default --border. Override explicitly. */
  --glass-border: 280 60% 70%;
  --glass-border-alpha: 0.18;
  --glass-inner-highlight: inset 0 1px 0 hsl(280 100% 90% / 0.08);
  --glass-outer-shadow:
    0 1px 2px hsl(260 60% 4% / 0.6),
    0 16px 40px hsl(260 80% 4% / 0.55);

  --elev-1: 0 1px 2px hsl(0 0% 0% / 0.35);
  --elev-2: 0 2px 4px hsl(0 0% 0% / 0.4), 0 6px 16px hsl(260 60% 4% / 0.4);
  --elev-3: 0 1px 2px hsl(0 0% 0% / 0.45), 0 12px 32px hsl(260 60% 4% / 0.45);
  --elev-4: 0 4px 8px hsl(0 0% 0% / 0.5), 0 28px 56px hsl(260 60% 4% / 0.6);

  --overlay: 260 60% 3%;
  --overlay-alpha: 0.55;
}
```

### 1.5 `white_sand`

```css
:root[data-theme="white_sand"] {
  --bg: 36 38% 94%;
  --bg-ambient: 200 50% 92%;
  --surface: 38 50% 97%;
  --surface-elevated: 38 60% 98%;
  --surface-sunken: 36 30% 90%;

  --border: 36 22% 80%;
  --border-strong: 36 20% 68%;

  --text-primary: 28 32% 18%;
  --text-muted: 30 16% 42%;
  --text-faint: 32 14% 58%;

  --accent: 198 72% 44%;
  --accent-hover: 198 76% 38%;
  --accent-soft: 198 60% 88%;
  --accent-fg: 0 0% 100%;

  --success: 160 52% 38%;
  --warning: 26 86% 52%;
  --danger:  8 70% 50%;

  --focus-ring: 198 72% 44%;
  --focus-ring-alpha: 0.45;

  --glass-alpha: 0.68;
  --glass-blur-filter: blur(18px) saturate(1.3);
  --glass-border: 36 30% 70%;
  --glass-border-alpha: 0.45;
  --glass-inner-highlight: inset 0 1px 0 hsl(38 60% 99% / 0.9);
  --glass-outer-shadow:
    0 1px 3px hsl(28 30% 30% / 0.08),
    0 10px 28px hsl(28 25% 35% / 0.10);

  --elev-1: 0 1px 2px hsl(28 30% 30% / 0.06);
  --elev-2: 0 2px 4px hsl(28 30% 30% / 0.07), 0 4px 12px hsl(28 25% 35% / 0.08);
  --elev-3: 0 1px 3px hsl(28 30% 30% / 0.08), 0 10px 28px hsl(28 25% 35% / 0.10);
  --elev-4: 0 4px 8px hsl(28 25% 30% / 0.10), 0 24px 48px hsl(28 25% 30% / 0.14);

  --overlay: 28 30% 20%;
  --overlay-alpha: 0.30;
}
```

### 1.6 `dark_forest`

```css
:root[data-theme="dark_forest"] {
  --bg: 150 22% 8%;
  --bg-ambient: 155 30% 6%;
  --surface: 150 18% 13%;
  --surface-elevated: 150 16% 16%;
  --surface-sunken: 150 22% 10%;

  --border: 150 14% 24%;
  --border-strong: 150 14% 34%;

  --text-primary: 60 12% 92%;
  --text-muted: 90 8% 66%;
  --text-faint: 100 8% 50%;

  --accent: 90 56% 58%;
  --accent-hover: 90 60% 66%;
  --accent-soft: 90 40% 18%;
  --accent-fg: 150 30% 10%;

  --success: 135 50% 56%;
  --warning: 42 78% 60%;
  --danger:  8 62% 56%;

  --focus-ring: 90 56% 58%;
  --focus-ring-alpha: 0.5;

  --glass-alpha: 0.56;
  --glass-blur-filter: blur(24px) saturate(1.35);
  --glass-border: 90 30% 60%;
  --glass-border-alpha: 0.18;
  --glass-inner-highlight: inset 0 1px 0 hsl(90 40% 80% / 0.10);
  --glass-outer-shadow:
    0 1px 2px hsl(150 40% 4% / 0.5),
    0 14px 36px hsl(150 50% 4% / 0.45);

  --elev-1: 0 1px 2px hsl(150 40% 4% / 0.35);
  --elev-2: 0 2px 4px hsl(150 40% 4% / 0.4), 0 6px 16px hsl(150 50% 4% / 0.4);
  --elev-3: 0 1px 2px hsl(150 40% 4% / 0.45), 0 12px 32px hsl(150 50% 4% / 0.45);
  --elev-4: 0 4px 8px hsl(150 40% 4% / 0.5), 0 28px 56px hsl(150 50% 4% / 0.6);

  --overlay: 150 40% 4%;
  --overlay-alpha: 0.5;
}
```

### 1.7 Gap notes

- The source spec uses `--border` for white_minimal / dark_minimal glass border, but tinted variants for the other three themes. Above, all themes set both `--glass-border` and `--glass-border-alpha`; minimal themes alias `--glass-border` to the same hue as `--border`. Add this aliasing for the two minimal themes if you don't want the glass utility to special-case:
  ```css
  :root[data-theme="white_minimal"] { --glass-border: 220 14% 90%; }
  :root[data-theme="dark_minimal"]  { --glass-border: 0 0% 100%; }   /* white at low alpha */
  ```
- Spec does not define `--accent-fg` explicitly; values above are proposed based on accent luminance.
- Spec does not define `--overlay` / `--overlay-alpha`; values above are inferred from §7.9.

---

## 2. Tailwind theme extension (`apps/web/tailwind.config.ts`)

```ts
import type { Config } from 'tailwindcss';

const hsl = (token: string) => `hsl(var(--${token}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:               hsl('bg'),
        'bg-ambient':     hsl('bg-ambient'),
        surface:          hsl('surface'),
        'surface-elevated': hsl('surface-elevated'),
        'surface-sunken': hsl('surface-sunken'),
        border:           hsl('border'),
        'border-strong':  hsl('border-strong'),
        'text-primary':   hsl('text-primary'),
        'text-muted':     hsl('text-muted'),
        'text-faint':     hsl('text-faint'),
        accent:           hsl('accent'),
        'accent-hover':   hsl('accent-hover'),
        'accent-soft':    hsl('accent-soft'),
        'accent-fg':      hsl('accent-fg'),
        success:          hsl('success'),
        warning:          hsl('warning'),
        danger:           hsl('danger'),
        'focus-ring':     hsl('focus-ring'),
      },
      borderColor: {
        DEFAULT: hsl('border'),
        strong: hsl('border-strong'),
      },
      textColor: {
        DEFAULT: hsl('text-primary'),
        muted:   hsl('text-muted'),
        faint:   hsl('text-faint'),
      },
      backgroundColor: {
        DEFAULT: hsl('bg'),
      },
      borderRadius: {
        xs:   'var(--radius-xs)',
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        '2xl':'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
        'elev-4': 'var(--elev-4)',
      },
      backdropBlur: {
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px',
      },
      spacing: {
        // base 4px scale plus designer additions
        px:   '1px',
        0.5:  '2px',
        1:    '4px',
        1.5:  '6px',
        2:    '8px',
        3:    '12px',
        4:    '16px',
        5:    '20px',
        6:    '24px',
        8:    '32px',
        10:   '40px',
        12:   '48px',
        16:   '64px',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter Display', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs':  ['0.6875rem', { lineHeight: '1.4',  letterSpacing: '0.02em',  fontWeight: '500' }],
        xs:     ['0.75rem',   { lineHeight: '1.4',  letterSpacing: '0.01em',  fontWeight: '500' }],
        sm:     ['0.8125rem', { lineHeight: '1.45', letterSpacing: '0',       fontWeight: '400' }],
        base:   ['0.875rem',  { lineHeight: '1.5',  letterSpacing: '0',       fontWeight: '400' }],
        md:     ['0.9375rem', { lineHeight: '1.55', letterSpacing: '0',       fontWeight: '400' }],
        lg:     ['1.0625rem', { lineHeight: '1.45', letterSpacing: '-0.005em',fontWeight: '500' }],
        xl:     ['1.25rem',   { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        '2xl':  ['1.5rem',    { lineHeight: '1.3',  letterSpacing: '-0.015em',fontWeight: '600' }],
        '3xl':  ['1.875rem',  { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '700' }],
        '4xl':  ['2.25rem',   { lineHeight: '1.2',  letterSpacing: '-0.025em',fontWeight: '700' }],
      },
      transitionTimingFunction: {
        'out-quart':    'var(--ease-out-quart)',
        'in-quart':     'var(--ease-in-quart)',
        'in-out-quart': 'var(--ease-in-out-quart)',
        spring:         'var(--ease-spring)',
      },
      transitionDuration: {
        hover:   '120ms',
        focus:   '100ms',
        popover: '140ms',
        dialog:  '220ms',
        sheet:   '280ms',
        toast:   '260ms',
      },
      ringColor: { DEFAULT: hsl('focus-ring') },
      ringOffsetColor: { DEFAULT: hsl('bg') },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 3. Glass surface utility (in `globals.css`)

```css
@layer components {
  .surface-glass {
    background-color: hsl(var(--surface) / var(--glass-alpha));
    backdrop-filter: var(--glass-blur-filter);
    -webkit-backdrop-filter: var(--glass-blur-filter);
    border: 1px solid hsl(var(--glass-border, var(--border)) / var(--glass-border-alpha));
    box-shadow:
      var(--glass-inner-highlight),
      var(--glass-outer-shadow);
  }

  /* Smaller variants for tooltips / popovers — overlay the alpha + blur, not the border */
  .surface-glass-sm { backdrop-filter: blur(8px)  saturate(1.1);  -webkit-backdrop-filter: blur(8px)  saturate(1.1);  }
  .surface-glass-md { backdrop-filter: blur(16px) saturate(1.25); -webkit-backdrop-filter: blur(16px) saturate(1.25); }
  .surface-glass-lg { backdrop-filter: blur(24px) saturate(1.4);  -webkit-backdrop-filter: blur(24px) saturate(1.4);  }
  .surface-glass-xl { backdrop-filter: blur(40px) saturate(1.5);  -webkit-backdrop-filter: blur(40px) saturate(1.5);  }

  /* Graceful fallback: no backdrop-filter support → opaque surface */
  @supports not (backdrop-filter: blur(1px)) {
    .surface-glass { background-color: hsl(var(--surface) / 0.95); }
  }

  /* Focus ring helper for non-button focusable elements */
  .focus-ring {
    @apply outline-none;
  }
  .focus-ring:focus-visible {
    box-shadow: 0 0 0 2px hsl(var(--bg)),
                0 0 0 4px hsl(var(--focus-ring) / var(--focus-ring-alpha, 0.5));
  }
}
```

---

## 4. Component pattern checklist

Build order suggestion: atoms first (Button → Input → Kbd → TagChip → StagePill → Badge family → Card → ListItem), then Radix wrappers, then composed widgets.

| Component | Radix primitive | Key props / variants | Notes |
|---|---|---|---|
| **Button** | none (HTML `<button>`, optional `Slot`) | `variant: primary \| secondary \| ghost \| destructive \| link`; `size: sm \| md \| lg \| icon`; `loading`, `leftIcon`, `rightIcon`, `asChild` | Primary uses `bg-accent text-accent-fg`; secondary uses `surface-glass` + border; loading swaps left icon for `Loader2`; `scale-[0.97]` on `:active`. |
| **Input** | none | `variant: text \| search \| with-shortcut \| error`; `leftIcon`, `rightIcon`, `kbd?` | `bg-surface-sunken/70 backdrop-blur-sm`, border `accent` on focus + focus ring. |
| **Kbd** | none | `children` | Inline-flex, `font-mono text-2xs`, 18px height, `bg-surface/80`, `border-default`. |
| **Card** | none | `variant: default \| compact \| bare`; `padding: sm \| md \| lg` | `surface-glass` + `rounded-lg`; title row supports trailing icon button. |
| **TagChip** | none | `interactive?`, `leadingIcon?` | h-[22px], `rounded-xs`, `text-2xs/500`, `surface-sunken/80`. |
| **StagePill** | none | `stage: idea \| prd \| building \| review \| shipped \| archived` | Color map (§7.18 of spec); `text-2xs uppercase tracking-[0.05em] font-semibold`. |
| **StatusPill** | none | `status: curious \| in_progress \| completed \| parked \| archived` | Mirror of StagePill for learning goals. |
| **StallBadge** | none | `severity: amber \| red`, `daysStalled` | Amber 1–7d; red 7d+ with pulsing dot. |
| **SnoozeBadge** | none | `until` (Date), `reason` | Truncate reason to 36 chars + tooltip with full text. |
| **ListItem** | none | `selected`, `snoozed`, `dense`, `onSelect`, `leadingIcon`, `meta1`, `meta2`, `tags`, `chevron?` | 56px default / 44px dense; hover gets mini-glass treatment; selected has 2px left border in accent. |
| **Tabs** | `@radix-ui/react-tabs` | `value`, `defaultValue`, `onValueChange` | Animated 2px underline (use Framer Motion layoutId or CSS transform). |
| **Dialog** | `@radix-ui/react-dialog` | `open`, `onOpenChange`, `title`, `description`, `footer` | `surface-glass surface-glass-lg`, `rounded-xl`, `shadow-elev-4`, max-w-[560px]; overlay uses `--overlay` token. |
| **Sheet** | `@radix-ui/react-dialog` w/ slide-from-right | `side: right`, `width` | Reading list detail panel (480px). |
| **Popover** | `@radix-ui/react-popover` | `open`, `onOpenChange`, `align`, `side` | `surface-glass surface-glass-md`, `rounded-md`, max-w-[320px]; 8px arrow. |
| **Tooltip** | `@radix-ui/react-tooltip` | `delayDuration: 400` | `surface-glass surface-glass-sm`, `text-xs`, no arrow. |
| **Toast** | `@radix-ui/react-toast` | `kind: success \| info \| warning \| danger`; `title`, `description?`, `action?` | Bottom-right desktop, top-center mobile; spring enter. |
| **DropdownMenu** | `@radix-ui/react-dropdown-menu` | standard Radix API | Actions menu on detail pages (`⋯`). |
| **Select** | `@radix-ui/react-select` | trigger looks like Input | Filter pickers, type-hint chooser. |
| **Combobox** | `cmdk` `Command` / `Command.Input` / `Command.List` | search + grouped items | Used inside Inbox "File..." popover and the ⌘K palette. |
| **Checkbox** | `@radix-ui/react-checkbox` | `checked: true \| false \| 'indeterminate'` | 18×18, `rounded-xs`, accent fill when checked. |
| **Switch** | `@radix-ui/react-switch` | `checked`, `onCheckedChange` | 32×18 track. |
| **ScrollArea** | `@radix-ui/react-scroll-area` | — | Wrap long lists; gives consistent custom scrollbar. |
| **Separator** | `@radix-ui/react-separator` | `orientation` | Use `hsl(var(--border) / 0.5)`. |
| **Avatar** | `@radix-ui/react-avatar` | `src`, `fallback` | Top-bar profile (initials fallback). |
| **VisuallyHidden** | `@radix-ui/react-visually-hidden` | `children` | A11y for icon-only buttons. |
| **CommandPalette** | `cmdk` | sections: Recent / Navigate / Actions / Search | Dialog wrapper, 640px, top 15% of viewport. |
| **CaptureModal** | `Dialog` + `@radix-ui/react-tabs?` | parses `/idea /note /curious /todo` prefix into chip | Submit on Enter; type chip rendered live. |
| **ThemeSwitcher** | `Popover` + 5 thumbnails | `onChange(theme: Theme)` | Writes `data-theme`, persists via server action + `localStorage`. |
| **CaptureInput** | `Input` (composed) | `placeholder`, `onSubmit` | Top-bar always-visible; expands to 560px on focus. |
| **ActivityEventRow** | none | `icon`, `timestamp`, `actor`, `description`, `href?` | Compact `text-sm`, 80px timestamp column. |
| **EmptyState** | none | `icon`, `title`, `description`, `action?` | No card, `space-12` vertical. |
| **Skeleton** | none | `variant: line \| rect \| circle`; `width`, `height` | Shimmer keyframe, 1400ms infinite. |
| **SidebarNav** | none + Next `Link` | `items[]`, active route highlight | `surface-glass surface-glass-xl`, fixed 240px, collapses at <1024px. |
| **TopBar** | none | hosts `CaptureInput`, theme switcher, notification toggle, avatar | `surface-glass surface-glass-xl`, 56px tall. |
| **AppShell** | none | wraps sidebar + topbar + main | RSC; renders mounting points for `<CommandPalette/>` and `<Toaster/>` client islands. |

---

## 5. Screen layout sketches

### 5.1 Dashboard (`/`)

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar: [⊕ Capture an idea, note, or topic...     ⌘N]      [☀][🔔][A] |
|         +------------------------------------------------------------------------+
|         |  Good evening, Adam.                                                   |
|         |  Tuesday · May 23                                                      |
|         |  +-----------------------------------------------------------------+   |
|         |  | MOMENTUM · last 7 days                                          |   |
|         |  |  ●  Compass build                  touched 12× · building       |   |
|         |  |  ●  Rust ownership model          touched  7× · in-progress     |   |
|         |  +-----------------------------------------------------------------+   |
|         |  +-------------------------------+ +-----------------------------+    |
|         |  | NEEDS ATTENTION         (3)   | | THIS WEEK              (4)  |    |
|         |  | ⏱ Stalled 5d                  | | ⊠ Compass v1 ship         |    |
|         |  +-------------------------------+ +-----------------------------+    |
|         |  +-----------------------------------------------------------------+   |
|         |  | COUNTS  12 projects | 8 goals | 23 inbox                        |   |
|         |  +-----------------------------------------------------------------+   |
+----------------------------------------------------------------------------------+
```

Composes: `AppShell` → `Greeting` (RSC) → `MomentumCard` (Card + ListItem rows + StagePill) → grid of `NeedsAttentionCard` (Card + ListItem + StallBadge) + `ThisWeekCard` (Card + ListItem with target date) → `CountsCard` (Card with three stat rows, `text-3xl` numerics).

### 5.2 Inbox (`/inbox`)

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +------------------------------------------------------------------------+
|         |  Inbox                                          23 items              |
|         |  [Filter: all / today / week ▾]   [Sort: newest ▾]                    |
|         |  +-------------------------------------------------------------------+|
|         |  | ⊕ "use cmdk for the palette..."  2m ago   [→ File...] [Edit] [⋯] ||
|         |  +-------------------------------------------------------------------+|
+----------------------------------------------------------------------------------+
```

Composes: `PageHeader` → `FilterBar` (Select × 2) → list of `InboxItem` (ListItem with TagChips + DropdownMenu actions). "File..." opens `Popover` containing a `Combobox` (cmdk) targeting projects/goals.

### 5.3 Projects list (`/projects`)

```
+----------------------------------------------------------------------------------+
|  Projects                                            12 active   [+ New]         |
|  [Stage ▾]  [Tag ▾]  [Sort: last-touched ▾]                  [⊞ List | ▦ Grid]   |
|  +------------------------------------------------------------------------------+|
|  | TITLE                          STAGE      LAST    SNZ   TAGS                 ||
|  |---------------------------------------------------------------------------- ||
|  | Compass v1                    [BUILDING]  2m     —     compass              ||
|  | Tax filing automation         [IDEA]      5d  [⏱5d]   —     ops             ||
|  | Stove timer hardware          [REVIEW]    1d   —   [💤Wed] iot              ||
|  +------------------------------------------------------------------------------+|
+----------------------------------------------------------------------------------+
```

Composes: `PageHeader` (title + count + primary Button) → `FilterBar` → dense table built from `ListItem` (44px variant) rows with StagePill, StallBadge, SnoozeBadge, TagChip cluster, hover-only chevron + DropdownMenu trigger.

### 5.4 Project detail (`/projects/[id]`)

```
+----------------------------------------------------------------------------------+
|  [< Projects]                                                                    |
|  Compass v1                                                       [⋯ Actions]   |
|  [BUILDING] ●  last touched 2 min ago  ·  #compass #ai-tools                    |
|  +---------------------------------+ +-------------------------------+          |
|  | SUMMARY                         | | LINKS                         |          |
|  | A personal dashboard for ...    | | • repo · github.com/...       |          |
|  +---------------------------------+ +-------------------------------+          |
|  [ Notes | Build runs | Activity ]                                              |
|  --- Notes tab content -------                                                  |
|   • cmdk has a built-in matcher       Today                                     |
|   • [+ Add note]                                                                |
+----------------------------------------------------------------------------------+
```

Composes: `BackLink` → `DetailHeader` (title `text-3xl`, StagePill, status dot, last-touched, TagChip row, DropdownMenu actions) → 2-column grid of `Card` (Summary, Links) → `Tabs` (Notes / Build runs / Activity) with `bare` Card content. Activity tab uses `ActivityEventRow`.

### 5.5 Learning list (`/learning`)

```
+----------------------------------------------------------------------------------+
|  Learning                                            8 active   [+ New]          |
|  [Status ▾]  [Tag ▾]  [Sort ▾]                       [Topics | Reading]          |
|  +------------------------------------------------------------------------------+|
|  | TOPIC                  STATUS      PROGRESS    READS  LAST                   ||
|  | Rust ownership model   [IN PROG]  ████░░ 4/7  2/5    2h                      ||
|  | LLM eval methods       [CURIOUS]  ░░░░░░ 0/0  0/2    7d  [⏱7d]              ||
|  +------------------------------------------------------------------------------+|
+----------------------------------------------------------------------------------+
```

Composes: same shell as Projects list. Adds `ProgressBar` cell (segmented `N/M`). Top-right segmented control toggles between this view and Reading list view.

### 5.6 Learning detail (`/learning/[id]`)

```
+----------------------------------------------------------------------------------+
|  [< Learning]                                                                    |
|  Rust ownership model                                            [⋯ Actions]    |
|  [IN PROGRESS] ●  4/7 done · #rust #systems-prog                                 |
|  Motivation: Want to internalize the borrow checker.                             |
|  [ Checklist | Resources | Notes | Activity ]                                    |
|  Checklist                                                                       |
|   [x] Understand move semantics                                                  |
|   [ ] Read Nomicon ch. 3                                                         |
|   [+ Add checklist item]                                                         |
+----------------------------------------------------------------------------------+
```

Composes: `BackLink` → `DetailHeader` (with StatusPill, progress, tags) → motivation block → `Tabs` (Checklist default / Resources / Notes / Activity). Checklist uses `Checkbox` + inline-edit label.

### 5.7 Reading list (`/learning/reading`)

```
+----------------------------------------------------------------------------------+
|  [< Learning] Reading                                  43 items   [+ Add]        |
|  [Status: all / to-read / reading / read / abandoned ▾]                          |
|  [Type: all / article / book / paper / video / course / other ▾]                 |
|  +------------------------------------------------------------------------------+|
|  | TITLE                                  TYPE    STATUS    GOAL                ||
|  | Designing Data-Intensive Applications  [BOOK]  [READING] systems             ||
|  | The Bitter Lesson                      [ART]   [READ]    llm                 ||
|  +------------------------------------------------------------------------------+|
+----------------------------------------------------------------------------------+
```

Composes: dense `ListItem` rows; row click opens `Sheet` (480px slide from right) with detail form: URL, author, kind Select, reading_status Select, rating, linked goal Combobox, takeaways note (textarea).

### 5.8 Settings (`/settings`)

```
+----------------------------------------------------------------------------------+
|  Settings                                                                        |
|  [ Appearance | Notifications | Capture | Account | Tokens ]                     |
|  Appearance                                                                      |
|  THEME                                                                           |
|  [white minimal ✓] [dark minimal] [outer space] [white sand] [dark forest]      |
|  DENSITY                                                                         |
|   ( ) Comfortable   (●) Compact   ( ) Dense                                      |
|  ---                                                                             |
|  Notifications                                                                   |
|  Telegram  [On  ◐ ]                                                              |
|  QUIET HOURS   From [22:00]  to [07:00]                                          |
|  PER-TRIGGER                                                                     |
|   [✓] Daily digest at [09:00]                                                    |
|   [✓] Stall alerts  projects [3d]  goals [2d]                                    |
|   [✓] Build run completion                                                       |
+----------------------------------------------------------------------------------+
```

Composes: top-level `Tabs`. Appearance tab: `ThemeGrid` (5 × `ThemeThumbnail` Cards, 96×72) + `RadioGroup` for density. Notifications tab: `Switch` rows, time `Input` pairs, threshold `Input[type=number]` pairs.

### 5.9 Capture modal (⌘N global)

```
                  +-------------------------------------------+
                  | Capture                              [Esc]|
                  +-------------------------------------------+
                  |  /idea  /note  /curious  /todo            |
                  |  [____________________________________]   |
                  |  Quickly capture an idea, note, or        |
                  |  curiosity. Type a slash to set the kind. |
                  |  Lands in Inbox · #unfiled                |
                  |       [Cancel]      [Capture  ⏎]          |
                  +-------------------------------------------+
```

Composes: `Dialog` (520px) → slash-prefix chip selector row (4 TagChips) → `Input` (single text, parses `/idea|/note|/curious|/todo` prefix into a chip and strips from value) → hint text → footer Buttons. Submits to `/api/v1/captures`. Success: close + `Toast` "Captured to Inbox · [open]".

### 5.10 Command palette (⌘K)

```
                  +--------------------------------------------------+
                  |  🔍  Search Compass or run a command...           |
                  +--------------------------------------------------+
                  |  Recent                                          |
                  |   • Compass v1                  [PROJECT]    ⏎  |
                  |  Navigate                                        |
                  |   ⇥ Dashboard                   [NAV]            |
                  |   ⇥ Inbox                       [NAV]    23     |
                  |  Actions                                         |
                  |   + Capture an idea             [ACTION]   ⌘N   |
                  |  Search results: "rust"                          |
                  |   • Rust ownership model        [GOAL]    97%   |
                  +--------------------------------------------------+
                  |  ↑↓ navigate    ⏎ open    esc close              |
                  +--------------------------------------------------+
```

Composes: `Dialog` (640px wide, top 15% from viewport) wrapping `cmdk`'s `Command` → `Command.Input` (no slash-prefix; pure search) → `Command.List` with `Command.Group` (Recent / Navigate / Actions / Search). Active row uses `bg-accent-soft`; trailing `Kbd` on focused row.

---

## 6. File structure (`apps/web/`)

```
apps/web/
├── app/
│   ├── globals.css                  # tokens + .surface-glass + base typography
│   ├── layout.tsx                   # <html data-theme> hydration, font loading
│   ├── (auth)/login/page.tsx
│   ├── (app)/layout.tsx             # AppShell mount
│   ├── (app)/page.tsx               # Dashboard
│   ├── (app)/inbox/page.tsx
│   ├── (app)/projects/page.tsx
│   ├── (app)/projects/[id]/page.tsx
│   ├── (app)/learning/page.tsx
│   ├── (app)/learning/[id]/page.tsx
│   ├── (app)/learning/reading/page.tsx
│   └── (app)/settings/page.tsx
├── components/
│   ├── ui/                          # atoms — no business logic
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Kbd.tsx
│   │   ├── Card.tsx
│   │   ├── TagChip.tsx
│   │   ├── StagePill.tsx
│   │   ├── StatusPill.tsx
│   │   ├── StallBadge.tsx
│   │   ├── SnoozeBadge.tsx
│   │   ├── ListItem.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Tabs.tsx                 # Radix wrappers — thin
│   │   ├── Dialog.tsx
│   │   ├── Popover.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Toast.tsx                # + Toaster mount component
│   │   ├── DropdownMenu.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   ├── Switch.tsx
│   │   ├── ScrollArea.tsx
│   │   ├── Separator.tsx
│   │   ├── Avatar.tsx
│   │   └── Sheet.tsx
│   ├── shell/
│   │   ├── AppShell.tsx             # RSC; composes Sidebar + TopBar + children
│   │   ├── SidebarNav.tsx           # client (active state via usePathname)
│   │   ├── TopBar.tsx               # client (capture input + right cluster)
│   │   ├── CaptureInput.tsx         # client
│   │   ├── ThemeSwitcher.tsx        # client; writes data-theme + persists
│   │   └── NotificationsToggle.tsx
│   ├── capture/
│   │   └── CaptureModal.tsx         # ⌘N global; mounted by AppShell
│   ├── palette/
│   │   └── CommandPalette.tsx       # ⌘K global; mounted by AppShell
│   ├── dashboard/
│   │   ├── MomentumCard.tsx
│   │   ├── NeedsAttentionCard.tsx
│   │   ├── ThisWeekCard.tsx
│   │   └── CountsCard.tsx
│   ├── inbox/
│   │   ├── InboxItem.tsx
│   │   └── FilePopover.tsx
│   ├── projects/
│   │   ├── ProjectsTable.tsx
│   │   ├── ProjectRow.tsx
│   │   ├── ProjectHeader.tsx
│   │   ├── ProjectActionsMenu.tsx
│   │   └── SnoozePopover.tsx
│   ├── learning/
│   │   ├── LearningTable.tsx
│   │   ├── LearningRow.tsx
│   │   ├── LearningHeader.tsx
│   │   └── ChecklistEditor.tsx
│   ├── reading/
│   │   ├── ReadingTable.tsx
│   │   └── ResourceSheet.tsx
│   ├── settings/
│   │   ├── ThemeGrid.tsx
│   │   ├── ThemeThumbnail.tsx
│   │   ├── DensityRadio.tsx
│   │   ├── NotificationsPanel.tsx
│   │   └── TokensTable.tsx
│   └── activity/
│       └── ActivityEventRow.tsx
├── lib/
│   ├── theme.ts                     # Theme type re-export + setTheme()
│   ├── density.ts                   # density multiplier helpers
│   ├── shortcuts.ts                 # global keybindings (mousetrap or hand-rolled)
│   ├── cn.ts                        # clsx + tailwind-merge
│   ├── fonts.ts                     # next/font Inter + JetBrains Mono
│   └── api.ts                       # typed fetch wrapper -> @compass/api-client
└── public/
```

Conventions:
- `components/ui/*` are pure presentational atoms — no API calls, no global state.
- All Radix wrappers in `ui/` re-export the Radix subcomponents with default styling applied — never import Radix directly outside `ui/`.
- `.surface-glass` utility lives in `app/globals.css` (not a component file) so it's available everywhere.
- `ThemeSwitcher` is the only place that calls `document.documentElement.setAttribute('data-theme', ...)`. Initial value injected via `app/layout.tsx` from server-read settings (avoids flash).

---

## 7. Day-one build order (week-1, day 1)

Following PRD §16.1 Day-1 target (UI track):

**Themes to ship first (2):**
1. `white_minimal` (default — first-run + light)
2. `dark_minimal` (covers `prefers-color-scheme: dark` first-run default)

Other three (`outer_space`, `white_sand`, `dark_forest`) ship Day 5 since they only require token-block additions once the architecture is proven on the two minimals.

**Five components to ship first (in order):**

| # | Component | Why first |
|---|---|---|
| 1 | `Button` | Used in every page; exercises focus ring, variants, sizes, loading state — proves the token plumbing end-to-end. |
| 2 | `Input` | Required by `CaptureInput` (top bar, always visible). Also exercises `surface-sunken` + `surface-glass-sm`. |
| 3 | `Card` | Composes `.surface-glass` — proves the glass utility renders correctly on both light + dark backgrounds. |
| 4 | `ListItem` | Workhorse pattern for Inbox, Projects, Learning, Reading. Hover/selected/snoozed states force you to validate every interactive token. |
| 5 | `Dialog` | Unlocks `CaptureModal` (the Day-2 capture flow) and proves overlay tokens + Radix integration before Day-5 palette work. |

Day-1 acceptance: AppShell renders with Sidebar + TopBar + main area on both `white_minimal` and `dark_minimal`. Clicking the theme switcher (rudimentary version, two buttons) instantly swaps tokens and cross-fades the ambient layer. Capture input in TopBar focuses and accepts text; submit goes to a stub server action.

---

## 8. Quick reference tables

### 8.1 Stage / status color mapping

| Stage / status | Background | Text |
|---|---|---|
| `idea` / `curious` | `hsl(var(--text-muted) / 0.15)` | `hsl(var(--text-muted))` |
| `prd` | `hsl(45 80% 60% / 0.18)` | `hsl(45 80% 40%)` |
| `building` / `in_progress` | `hsl(var(--accent-soft))` | `hsl(var(--accent))` |
| `review` | `hsl(280 60% 60% / 0.18)` | violet-tinted (theme-adjusted) |
| `shipped` / `completed` | `hsl(var(--success) / 0.18)` | `hsl(var(--success))` |
| `archived` / `parked` | `hsl(var(--text-faint) / 0.15)` | `hsl(var(--text-faint))` |

### 8.2 Global keyboard shortcuts (`lib/shortcuts.ts`)

| Combo | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘N` / `Ctrl+N` | Open capture modal |
| `⌘,` / `Ctrl+,` | Open settings |
| `Esc` | Close any modal / popover |
| `/` | Focus search (when not in input) |
| `j` / `k` | List nav (next / prev) |
| `Enter` | Open selected list item |
| `g d / g i / g p / g l / g s` | Go to Dashboard / Inbox / Projects / Learning / Settings |

### 8.3 Breakpoints

| Name | Min | Behavior |
|---|---|---|
| `sm` | 640px | mobile single-column |
| `md` | 768px | sidebar collapsed (56px icons) |
| `lg` | 1024px | full 240px sidebar |
| `xl` | 1280px | default target |
| `2xl` | 1536px | content max-width 1440px centered |

### 8.4 Icon set (lucide-react, `strokeWidth={1.5}`)

`Archive`, `ArrowRight`, `Bell`, `BellOff`, `Bookmark`, `BookOpen`, `Check`, `CheckSquare`, `ChevronDown`, `ChevronRight`, `Circle`, `Clock`, `Command`, `Copy`, `Edit3`, `ExternalLink`, `FileText`, `Filter`, `Flag`, `Folder`, `Hash`, `Home`, `Inbox`, `Info`, `Layers`, `Link2`, `List`, `Loader2`, `MoreHorizontal`, `Moon`, `Palette`, `Pause`, `Pencil`, `Plus`, `Search`, `Send`, `Settings`, `Sparkles`, `Square`, `Star`, `Sun`, `Tag`, `Target`, `Trash2`, `X`, `Zap`.

### 8.5 First-run theme selection

```ts
// app/layout.tsx — inlined before hydration to avoid FOUC
const initialTheme: Theme =
  settings?.active_theme
  ?? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark_minimal'
        : 'white_minimal');
```

---

**End of implementation reference.**
