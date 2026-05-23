# Compass — UI & Themes Design Specification

**Version:** 1.0
**Date:** 2026-05-23
**Status:** Ready for week-1 implementation
**Author:** Design (handoff to engineering)

This document is the complete week-1 design contract for Compass. It specifies five fully-realized themes, component patterns built on Radix primitives, motion language, and screen-level layouts. An engineer should be able to implement the entire UI surface from this document without further design back-and-forth.

---

## 0. Foundations

### 0.1 Aesthetic principles

| Principle | Implementation |
|---|---|
| **Liquid-glass skeuomorphism** | Translucent surfaces (alpha 0.4–0.7), backdrop-blur (16–28px), subtle saturation boost (1.2–1.4×), 1px inner highlight border, soft drop shadow. No bevels, no gradients fighting for attention. Depth via layering and blur, not stroke weight. |
| **Peaceful, eye-catching, not gaudy** | Restrained accent use (one accent per region max). Themes are atmospheric not loud. Background ambience does the heavy lifting; UI chrome stays quiet. |
| **Dense but calm** | Compact line-heights for lists (1.35), generous line-heights for body copy (1.55). Tight spacing on dense surfaces (4px/8px), relaxed on detail surfaces (16px/24px). |
| **Keyboard-first** | Every interactive element has a focus-visible ring. Shortcut hints visible at rest on global affordances. ⌘K palette is the spine. |

### 0.2 Cross-theme architecture

All themes share the same:

- Token names (`--bg`, `--surface`, `--accent`, etc.)
- Component pattern library
- Motion language
- Typography scale
- Spacing scale
- Radii
- Iconography (Lucide, 1.5px stroke)

Themes differ only in:

- Token values (color, blur amount, glass alpha, shadow opacity)
- Background ambience (CSS gradient or noise layer behind the app shell)
- Optional ambient particle/grain layer (Outer Space, White Sand Beach, Dark Forest)

### 0.3 Theme system implementation

Themes are CSS variables on `:root[data-theme="..."]`. Tailwind reads variables via `theme.extend.colors.{name}: 'hsl(var(--{token}) / <alpha-value>)'`.

```css
:root[data-theme="white-minimal"] { /* default at first run */
  --bg: 220 14% 98%;
  --surface: 0 0% 100%;
  --glass-alpha: 0.62;
  --glass-blur: 20px;
  /* ... full token set per section 1 ... */
}
```

Theme switch is instantaneous (no transition) on root; ambient layers cross-fade over 320ms (motion section).

### 0.4 Default theme

**White Minimal** is the first-run default. It is the calmest of the five and reads correctly on standard monitor calibration without prior context.

---

## 1. The Five Themes

For each theme: semantic color tokens (HSL), glass material spec, ambient layer description.

### 1.1 White Minimal (default)

Calm, clean, restrained. Reads like a stack of frosted paper on warm white.

| Token | HSL | Hex (sRGB) | Use |
|---|---|---|---|
| `--bg` | `220 14% 98%` | `#F8F9FB` | App background |
| `--bg-ambient` | `220 24% 96%` | `#F1F4F8` | Subtle radial gradient overlay |
| `--surface` | `0 0% 100%` | `#FFFFFF` | Card base (pre-glass) |
| `--surface-elevated` | `0 0% 100%` | `#FFFFFF` | Modal, popover base |
| `--surface-sunken` | `220 14% 95%` | `#EFF1F4` | Input field, nested area |
| `--border` | `220 14% 90%` | `#E1E5EB` | Default border |
| `--border-strong` | `220 12% 82%` | `#CCD1D9` | Hover / active border |
| `--text-primary` | `220 18% 14%` | `#1E232C` | Body, headings |
| `--text-muted` | `220 10% 46%` | `#6B7280` | Captions, meta |
| `--text-faint` | `220 8% 64%` | `#9AA1AB` | Hint, placeholder |
| `--accent` | `217 92% 52%` | `#1E70F0` | Primary accent (azure) |
| `--accent-hover` | `217 92% 46%` | `#1561D8` | Hover variant |
| `--accent-soft` | `217 92% 94%` | `#E2EDFD` | Soft fill for chips |
| `--success` | `152 60% 42%` | `#2BAA72` | Success state |
| `--warning` | `38 92% 52%` | `#F1A416` | Warning state, stall amber |
| `--danger` | `0 72% 52%` | `#DE3B3B` | Destructive, stall red |
| `--focus-ring` | `217 92% 52%` | `#1E70F0` | Focus outline (alpha 0.4) |

**Glass surface spec:**

| Property | Value |
|---|---|
| Base color | `hsl(var(--surface) / 0.72)` |
| Backdrop filter | `blur(20px) saturate(1.4)` |
| Border | `1px solid hsl(var(--border) / 0.6)` |
| Inner highlight | `box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.8)` |
| Outer shadow | `0 1px 2px hsl(220 12% 20% / 0.04), 0 8px 24px hsl(220 12% 20% / 0.06)` |

**Ambient layer:** Single radial gradient top-left, `radial-gradient(1200px 600px at 10% -10%, hsl(217 92% 96%) 0%, transparent 60%)`. No grain.

### 1.2 Dark Minimal

Calm, low-contrast, restrained. Reads like soft graphite under low light.

| Token | HSL | Hex | Use |
|---|---|---|---|
| `--bg` | `222 18% 8%` | `#10131A` | App background |
| `--bg-ambient` | `222 22% 6%` | `#0C0E14` | Ambient overlay |
| `--surface` | `222 14% 12%` | `#191C24` | Card base |
| `--surface-elevated` | `222 14% 14%` | `#1E222B` | Modal, popover |
| `--surface-sunken` | `222 16% 10%` | `#161922` | Input field |
| `--border` | `222 12% 22%` | `#323742` | Default border |
| `--border-strong` | `222 12% 32%` | `#4A5060` | Hover border |
| `--text-primary` | `220 14% 92%` | `#E8EAEF` | Body, headings |
| `--text-muted` | `220 8% 64%` | `#9AA1AB` | Captions |
| `--text-faint` | `220 6% 46%` | `#6E737C` | Hint, placeholder |
| `--accent` | `200 90% 62%` | `#3FB9F0` | Primary accent (sky) |
| `--accent-hover` | `200 90% 70%` | `#5FC6F3` | Hover |
| `--accent-soft` | `200 60% 18%` | `#0F3548` | Soft fill |
| `--success` | `152 50% 52%` | `#41B97E` | Success |
| `--warning` | `38 86% 58%` | `#EBB245` | Warning |
| `--danger` | `0 68% 60%` | `#E14E4E` | Destructive |
| `--focus-ring` | `200 90% 62%` | `#3FB9F0` | Focus (alpha 0.5) |

**Glass surface:**

| Property | Value |
|---|---|
| Base | `hsl(var(--surface) / 0.58)` |
| Backdrop filter | `blur(22px) saturate(1.2)` |
| Border | `1px solid hsl(0 0% 100% / 0.06)` |
| Inner highlight | `inset 0 1px 0 hsl(0 0% 100% / 0.05)` |
| Outer shadow | `0 1px 2px hsl(0 0% 0% / 0.4), 0 12px 32px hsl(0 0% 0% / 0.35)` |

**Ambient:** `radial-gradient(900px 500px at 15% 0%, hsl(222 30% 14%) 0%, transparent 65%)`. No grain.

### 1.3 Outer Space

Deep space, nebula gradients, cosmic dust. Peaceful, atmospheric.

| Token | HSL | Hex | Use |
|---|---|---|---|
| `--bg` | `245 38% 7%` | `#0B0A1B` | App background (near-black violet) |
| `--bg-ambient` | `260 50% 5%` | `#0A0613` | Ambient layer |
| `--surface` | `245 28% 13%` | `#1C1A2B` | Card base |
| `--surface-elevated` | `245 26% 16%` | `#23213A` | Modal |
| `--surface-sunken` | `245 32% 10%` | `#15132A` | Input field |
| `--border` | `245 20% 28%` | `#3D3956` | Default border |
| `--border-strong` | `260 24% 38%` | `#564E78` | Hover |
| `--text-primary` | `250 30% 94%` | `#EDEAF5` | Body |
| `--text-muted` | `250 18% 70%` | `#A8A4BE` | Captions |
| `--text-faint` | `250 12% 52%` | `#7D7894` | Hint |
| `--accent` | `280 80% 68%` | `#B377F2` | Nebula violet |
| `--accent-hover` | `280 84% 76%` | `#C695F5` | Hover |
| `--accent-soft` | `280 50% 20%` | `#3D1F4D` | Soft fill |
| `--success` | `162 60% 58%` | `#56D5A8` | Aurora teal |
| `--warning` | `38 88% 62%` | `#EFB955` | Star amber |
| `--danger` | `350 78% 62%` | `#E84F6F` | Red-giant rose |
| `--focus-ring` | `280 80% 68%` | `#B377F2` | Focus (alpha 0.55) |

**Glass surface:**

| Property | Value |
|---|---|
| Base | `hsl(var(--surface) / 0.52)` |
| Backdrop filter | `blur(28px) saturate(1.5)` |
| Border | `1px solid hsl(280 60% 70% / 0.18)` |
| Inner highlight | `inset 0 1px 0 hsl(280 100% 90% / 0.08)` |
| Outer shadow | `0 1px 2px hsl(260 60% 4% / 0.6), 0 16px 40px hsl(260 80% 4% / 0.55)` |

**Ambient (layered):**
1. Base nebula: `conic-gradient(from 220deg at 30% 20%, hsl(260 60% 12%), hsl(280 50% 10%), hsl(220 60% 12%), hsl(260 60% 12%))` with 0.7 opacity.
2. Cosmic dust overlay: SVG noise filter at 0.04 opacity (`feTurbulence baseFrequency="0.9"`).
3. Sparse star points: 24 fixed positioned `1px` and `2px` white dots at alpha 0.5–0.9, randomized positions, no animation in v1.

### 1.4 White Sand Beach

Sun-bleached, warm sand, ocean horizon. Peaceful, bright.

| Token | HSL | Hex | Use |
|---|---|---|---|
| `--bg` | `36 38% 94%` | `#F4ECE0` | Warm sand |
| `--bg-ambient` | `200 50% 92%` | `#DCEDF4` | Horizon haze |
| `--surface` | `38 50% 97%` | `#FAF5EC` | Card base (warm cream) |
| `--surface-elevated` | `38 60% 98%` | `#FCF8F0` | Modal |
| `--surface-sunken` | `36 30% 90%` | `#E8DECE` | Input field |
| `--border` | `36 22% 80%` | `#D2C5B0` | Default border |
| `--border-strong` | `36 20% 68%` | `#B5A48A` | Hover |
| `--text-primary` | `28 32% 18%` | `#3D2E1F` | Body (warm graphite) |
| `--text-muted` | `30 16% 42%` | `#7B6953` | Captions |
| `--text-faint` | `32 14% 58%` | `#9D8E7A` | Hint |
| `--accent` | `198 72% 44%` | `#1F8BC0` | Ocean blue |
| `--accent-hover` | `198 76% 38%` | `#177AAD` | Hover |
| `--accent-soft` | `198 60% 88%` | `#CDE6F4` | Soft fill |
| `--success` | `160 52% 38%` | `#2E9477` | Sea-glass green |
| `--warning` | `26 86% 52%` | `#E97F1A` | Sunset orange |
| `--danger` | `8 70% 50%` | `#D9482A` | Coral |
| `--focus-ring` | `198 72% 44%` | `#1F8BC0` | Focus (alpha 0.45) |

**Glass surface:**

| Property | Value |
|---|---|
| Base | `hsl(var(--surface) / 0.68)` |
| Backdrop filter | `blur(18px) saturate(1.3)` |
| Border | `1px solid hsl(36 30% 70% / 0.45)` |
| Inner highlight | `inset 0 1px 0 hsl(38 60% 99% / 0.9)` |
| Outer shadow | `0 1px 3px hsl(28 30% 30% / 0.08), 0 10px 28px hsl(28 25% 35% / 0.10)` |

**Ambient (layered):**
1. Horizon: `linear-gradient(180deg, hsl(200 60% 90%) 0%, hsl(200 40% 94%) 35%, hsl(36 38% 94%) 36%, hsl(36 50% 96%) 100%)` — sky meets sand at ~35% from top.
2. Sun glow: `radial-gradient(800px 400px at 75% 18%, hsl(40 100% 88% / 0.6), transparent 70%)`.
3. Optional very faint grain at 0.02 opacity to suggest sand texture.

### 1.5 Dark Forest

Moss greens, deep shadows, dappled light. Peaceful, earthy.

| Token | HSL | Hex | Use |
|---|---|---|---|
| `--bg` | `150 22% 8%` | `#101A14` | Forest floor |
| `--bg-ambient` | `155 30% 6%` | `#0B140F` | Deep shade |
| `--surface` | `150 18% 13%` | `#1B2620` | Card (moss-stone) |
| `--surface-elevated` | `150 16% 16%` | `#222E27` | Modal |
| `--surface-sunken` | `150 22% 10%` | `#141F19` | Input field |
| `--border` | `150 14% 24%` | `#34453B` | Default border |
| `--border-strong` | `150 14% 34%` | `#4B6253` | Hover |
| `--text-primary` | `60 12% 92%` | `#EDEFE5` | Body (warm bone) |
| `--text-muted` | `90 8% 66%` | `#A5AEA0` | Captions |
| `--text-faint` | `100 8% 50%` | `#7D8678` | Hint |
| `--accent` | `90 56% 58%` | `#94CB54` | Young leaf |
| `--accent-hover` | `90 60% 66%` | `#A8D573` | Hover |
| `--accent-soft` | `90 40% 18%` | `#2D3F18` | Soft fill |
| `--success` | `135 50% 56%` | `#5DBF7A` | Fresh moss |
| `--warning` | `42 78% 60%` | `#E5B652` | Lichen amber |
| `--danger` | `8 62% 56%` | `#D26852` | Rust |
| `--focus-ring` | `90 56% 58%` | `#94CB54` | Focus (alpha 0.5) |

**Glass surface:**

| Property | Value |
|---|---|
| Base | `hsl(var(--surface) / 0.56)` |
| Backdrop filter | `blur(24px) saturate(1.35)` |
| Border | `1px solid hsl(90 30% 60% / 0.18)` |
| Inner highlight | `inset 0 1px 0 hsl(90 40% 80% / 0.10)` |
| Outer shadow | `0 1px 2px hsl(150 40% 4% / 0.5), 0 14px 36px hsl(150 50% 4% / 0.45)` |

**Ambient (layered):**
1. Base wash: `radial-gradient(1000px 700px at 70% 10%, hsl(150 30% 14%) 0%, transparent 60%), hsl(var(--bg))`.
2. Dappled light: 5–7 large soft elliptical highlights at 0.06 opacity in warm-green tone, fixed positions.
3. Grain: SVG noise at 0.03 opacity for organic texture.

---

## 2. Typography

### 2.1 Font stack

| Role | Family | Fallback stack |
|---|---|---|
| Display (large numerics, hero headings) | **Inter Display** (variable) | `'Inter Display', 'Inter', system-ui, -apple-system, sans-serif` |
| UI / Body | **Inter** (variable) | `Inter, system-ui, -apple-system, 'Segoe UI', sans-serif` |
| Monospace (IDs, tokens, code) | **JetBrains Mono** | `'JetBrains Mono', 'SF Mono', Menlo, monospace` |

Inter is single source of truth across all themes. Subset to Latin extended; load via `next/font` with `display: swap`.

### 2.2 Scale

| Token | Size (rem) | Size (px) | Line-height | Weight | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `text-2xs` | 0.6875 | 11 | 1.4 | 500 | 0.02em | Stage pills, badges |
| `text-xs` | 0.75 | 12 | 1.4 | 500 | 0.01em | Meta, captions, hint |
| `text-sm` | 0.8125 | 13 | 1.45 | 400 | 0 | Dense list rows |
| `text-base` | 0.875 | 14 | 1.5 | 400 | 0 | Default body |
| `text-md` | 0.9375 | 15 | 1.55 | 400 | 0 | Read-optimized body |
| `text-lg` | 1.0625 | 17 | 1.45 | 500 | -0.005em | Card titles |
| `text-xl` | 1.25 | 20 | 1.35 | 600 | -0.01em | Section headings |
| `text-2xl` | 1.5 | 24 | 1.3 | 600 | -0.015em | Screen headings |
| `text-3xl` | 1.875 | 30 | 1.25 | 700 | -0.02em | Page headings |
| `text-4xl` | 2.25 | 36 | 1.2 | 700 | -0.025em | Hero numerics |

### 2.3 Weight tokens

`font-regular: 400`, `font-medium: 500`, `font-semibold: 600`, `font-bold: 700`. Never use weights below 400 (legibility on glass surfaces).

### 2.4 Numeric & tabular

Use `font-variant-numeric: tabular-nums` for all numeric columns (counts, dates, percentages).

---

## 3. Spacing scale

Tailwind-compatible. Base unit 4px.

| Token | Value | Use |
|---|---|---|
| `space-0` | 0 | — |
| `space-px` | 1px | Hairline border |
| `space-0.5` | 2px | Tight inner spacing |
| `space-1` | 4px | Icon-to-text |
| `space-1.5` | 6px | Dense lists |
| `space-2` | 8px | Default tight |
| `space-3` | 12px | Default loose, button padding |
| `space-4` | 16px | Card padding (small) |
| `space-5` | 20px | Card padding (default) |
| `space-6` | 24px | Card padding (large), section gap |
| `space-8` | 32px | Subsection gap |
| `space-10` | 40px | Major section gap |
| `space-12` | 48px | Screen-level gap |
| `space-16` | 64px | Hero padding |

---

## 4. Radii, shadows, blurs

### 4.1 Radii

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 4px | Pills, chips, small badges |
| `radius-sm` | 6px | Inputs, buttons |
| `radius-md` | 10px | List items, small cards |
| `radius-lg` | 14px | Cards |
| `radius-xl` | 20px | Dialogs, large cards |
| `radius-2xl` | 28px | Hero panels |
| `radius-full` | 9999px | Avatars, status dots |

### 4.2 Elevation (shadows)

Defined per theme (light themes use grey-ink shadows; dark themes use deeper black with subtle accent tint). Tokens:

| Token | White / Sand | Dark / Forest / Space |
|---|---|---|
| `elev-0` | none | none |
| `elev-1` | `0 1px 2px hsl(220 12% 20% / 0.04)` | `0 1px 2px hsl(0 0% 0% / 0.3)` |
| `elev-2` | `0 2px 4px hsl(220 12% 20% / 0.05), 0 4px 12px hsl(220 12% 20% / 0.05)` | `0 2px 4px hsl(0 0% 0% / 0.35), 0 6px 16px hsl(0 0% 0% / 0.35)` |
| `elev-3` (card) | `0 1px 2px hsl(220 12% 20% / 0.04), 0 8px 24px hsl(220 12% 20% / 0.06)` | `0 1px 2px hsl(0 0% 0% / 0.4), 0 12px 32px hsl(0 0% 0% / 0.4)` |
| `elev-4` (dialog) | `0 4px 8px hsl(220 12% 20% / 0.06), 0 24px 48px hsl(220 12% 20% / 0.12)` | `0 4px 8px hsl(0 0% 0% / 0.45), 0 28px 56px hsl(0 0% 0% / 0.55)` |

Specific overrides per theme in section 1.

### 4.3 Blurs

| Token | Value | Use |
|---|---|---|
| `blur-sm` | `blur(8px) saturate(1.1)` | Tooltip, small popover |
| `blur-md` | `blur(16px) saturate(1.25)` | Card glass |
| `blur-lg` | `blur(24px) saturate(1.4)` | Dialog, dropdown menus |
| `blur-xl` | `blur(40px) saturate(1.5)` | Sidebar, top bar |

Per-theme overrides in section 1.

---

## 5. Motion

All durations measured in ms. Use CSS variables so designers can retune globally.

### 5.1 Easing curves

| Token | Curve | Use |
|---|---|---|
| `ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Default enter, hover-in |
| `ease-in-quart` | `cubic-bezier(0.5, 0, 0.75, 0)` | Exit, hover-out |
| `ease-in-out-quart` | `cubic-bezier(0.76, 0, 0.24, 1)` | Modal, slide |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small playful (toast pop, chip add) |

### 5.2 Durations

| Interaction | Duration | Easing |
|---|---|---|
| Hover color / bg change | 120ms | `ease-out-quart` |
| Focus ring fade-in | 100ms | `ease-out-quart` |
| Press (active state) | 60ms | linear |
| Button loading spinner fade | 160ms | `ease-out-quart` |
| Popover / tooltip open | 140ms | `ease-out-quart` |
| Popover / tooltip close | 100ms | `ease-in-quart` |
| Dialog open (fade + scale 0.96 → 1) | 220ms | `ease-out-quart` |
| Dialog close | 160ms | `ease-in-quart` |
| Sheet / drawer slide | 280ms | `ease-in-out-quart` |
| Toast enter (translate + fade) | 260ms | `ease-spring` |
| Toast exit | 180ms | `ease-in-quart` |
| List item reorder | 240ms | `ease-in-out-quart` |
| Tabs underline slide | 200ms | `ease-in-out-quart` |
| Theme switch (ambient cross-fade) | 320ms | `ease-in-out-quart` |
| Theme switch (tokens) | instant | — (no transition on `:root`) |
| Skeleton shimmer | 1400ms | linear infinite |

### 5.3 Reduced motion

When `prefers-reduced-motion: reduce`, all durations clamp to ≤80ms and disable `scale` / `translate` transforms; only opacity transitions remain. Theme cross-fade reduces to 0ms (instant).

---

## 6. Iconography

**Library:** Lucide React (`lucide-react`).
**Stroke weight:** 1.5px (override library default of 2px via `strokeWidth={1.5}` globally).
**Default size:** 16px in dense UI, 20px on buttons, 24px in empty states.
**Color:** Inherits `currentColor` from parent text token.

Icon set in week 1 (alphabetical, comprehensive):
`Archive`, `ArrowRight`, `Bell`, `BellOff`, `Bookmark`, `BookOpen`, `Check`, `CheckSquare`, `ChevronDown`, `ChevronRight`, `Circle`, `Clock`, `Command`, `Copy`, `Edit3`, `ExternalLink`, `FileText`, `Filter`, `Flag`, `Folder`, `Hash`, `Home`, `Inbox`, `Info`, `Layers`, `Link2`, `List`, `Loader2`, `MoreHorizontal`, `Moon`, `Palette`, `Pause`, `Pencil`, `Plus`, `Search`, `Send`, `Settings`, `Sparkles`, `Square`, `Star`, `Sun`, `Tag`, `Target`, `Trash2`, `X`, `Zap`.

---

## 7. Component pattern library

All components built on Radix primitives where applicable. No shadcn. Each pattern uses theme tokens; identical structure across themes.

### 7.1 Radix primitive inventory

| Component | Package |
|---|---|
| Dialog | `@radix-ui/react-dialog` |
| Popover | `@radix-ui/react-popover` |
| Tooltip | `@radix-ui/react-tooltip` |
| Toast | `@radix-ui/react-toast` |
| Tabs | `@radix-ui/react-tabs` |
| Select | `@radix-ui/react-select` |
| Combobox (via cmdk) | `cmdk` |
| Checkbox | `@radix-ui/react-checkbox` |
| Switch | `@radix-ui/react-switch` |
| Dropdown Menu | `@radix-ui/react-dropdown-menu` |
| Avatar (fallback) | `@radix-ui/react-avatar` |
| Visually Hidden | `@radix-ui/react-visually-hidden` |
| Scroll Area | `@radix-ui/react-scroll-area` |
| Separator | `@radix-ui/react-separator` |

### 7.2 App shell

```
+--------------------------------------------------------------------+
| Sidebar (240px)            | Main area (flex)                      |
|  [Logo] Compass            |  Top bar (56px)                       |
|  ----                      |  ----                                 |
|  [/]  Dashboard            |  Screen content (scroll area)         |
|  [⊞]  Inbox       (3)      |                                       |
|  [⊠]  Projects    (12)     |                                       |
|  [✦]  Learning     (8)     |                                       |
|       └ Reading            |                                       |
|  [⚙]  Settings             |                                       |
|  ----                      |                                       |
|  [⌘K] Search...     ⌘K     |                                       |
+--------------------------------------------------------------------+
```

- Sidebar: glass surface with `blur-xl`, fixed 240px wide on desktop, collapses to 56px icons-only at <1024px.
- Top bar: glass surface with `blur-xl`, contains capture input (left, 480px max-width), spacer, right-cluster (theme switcher icon, notification toggle icon, profile avatar).
- Main area uses `surface-sunken` token color as base; cards float over it as glass.

### 7.3 Top bar with capture input + ⌘K trigger

```
+---------------------------------------------------------------+
| [⊕ Capture an idea, note, or topic...        ⌘N] [...] [☀] [⚙] |
+---------------------------------------------------------------+
```

- Capture input: full glass treatment (radius-md, blur-md). Left icon Plus, right kbd hint `⌘N`. On focus the kbd hint fades, the input expands to 560px with smooth 180ms transition. On submit, posts to Inbox with current type heuristic (see capture modal).
- Right cluster: theme switcher (Palette icon → popover with 5 theme thumbnails), notification toggle (Bell / BellOff), profile (initials avatar).

### 7.4 Card

The atomic dashboard building block.

- Surface: glass per theme spec.
- Default padding: `space-5` (20px).
- Radius: `radius-lg` (14px).
- Title row: `text-lg` weight 500, optional right-aligned action icon button.
- Body: `text-base`.
- Internal sections separated by `Separator` (Radix) with `hsl(var(--border) / 0.5)`.

Variants:
- `compact` — padding `space-4`, title `text-md`.
- `bare` — no glass, transparent background, used inside Tabs panels.

### 7.5 Glass surface utility

Implementation as a single Tailwind utility `.glass`:

```css
.glass {
  background: hsl(var(--surface) / var(--glass-alpha));
  backdrop-filter: var(--glass-blur-filter);
  -webkit-backdrop-filter: var(--glass-blur-filter);
  border: 1px solid hsl(var(--border) / var(--glass-border-alpha));
  box-shadow:
    var(--glass-inner-highlight),
    var(--glass-outer-shadow);
}
```

Each theme defines the four variables (`--glass-alpha`, `--glass-blur-filter`, `--glass-border-alpha`, `--glass-inner-highlight`, `--glass-outer-shadow`). Components compose `.glass` rather than recomputing the material.

Fallback: when `@supports not (backdrop-filter: blur(1px))`, alpha drops to 0.95 and ambient layer hides — opaque surface degrades gracefully.

### 7.6 Button

Variants × sizes × states.

**Variants:**
| Name | Background | Text | Border |
|---|---|---|---|
| `primary` | `hsl(var(--accent))` | `white` (or theme-appropriate ink) | none |
| `secondary` | `hsl(var(--surface) / 0.6)` glass | `var(--text-primary)` | `1px var(--border)` |
| `ghost` | transparent | `var(--text-primary)` | none, hover bg `hsl(var(--surface) / 0.4)` |
| `destructive` | `hsl(var(--danger))` | white | none |
| `link` | transparent | `var(--accent)` | none, underline on hover |

**Sizes:**
| Name | Height | Padding-X | Text | Icon |
|---|---|---|---|---|
| `sm` | 28px | 10px | `text-sm` | 14px |
| `md` (default) | 36px | 14px | `text-base` | 16px |
| `lg` | 44px | 18px | `text-md` | 18px |
| `icon` | 36×36 square | 0 | — | 16px |

**States:**
- Hover: 120ms `ease-out-quart` color change.
- Active (pressing): `scale: 0.97`, 60ms linear.
- Focus-visible: 2px outline at `hsl(var(--focus-ring) / 0.5)`, 2px offset.
- Disabled: `opacity: 0.5`, cursor not-allowed, no hover.
- Loading: replace leading icon with `Loader2` spinning; disable interaction; preserve width.

### 7.7 Input

- Height 36px (sm: 28px, lg: 44px).
- Radius `radius-sm`.
- Background `hsl(var(--surface-sunken) / 0.7)` with `blur-sm`.
- Border `1px hsl(var(--border))`; on focus `hsl(var(--accent))` + focus ring.
- Padding-X `space-3`; if leading icon, `space-3 + 20px + space-2`.
- Placeholder uses `text-faint`.
- Trailing shortcut hint: `<Kbd>` component, `text-2xs`, `text-muted`, glass background, radius-xs.

Variants: `text`, `search` (leading Search icon), `with-shortcut` (trailing Kbd), `error` (border `var(--danger)`).

### 7.8 Select / Combobox

- **Select** (closed-set): Radix Select. Trigger looks identical to Input. Content panel: glass with `blur-lg`, radius-md, padding `space-1`. Items: 32px height, padding-X `space-3`, hover bg `hsl(var(--accent-soft))`, selected check icon trailing.
- **Combobox** (search + select): built on `cmdk`. Same visual shell as Select but with search input at top and grouped items below.

### 7.9 Dialog / modal

- Overlay: `hsl(0 0% 0% / 0.4)` for dark themes, `hsl(220 18% 14% / 0.25)` for light. Backdrop-filter `blur(8px)` for additional defocus.
- Content: glass with `blur-lg`, radius-xl, `elev-4` shadow, max-width 560px default, padding `space-6`.
- Open animation: overlay fades 220ms; content fades + scales from 0.96 to 1 with `ease-out-quart`.
- Close on Esc, overlay click, X button (top-right, ghost icon button).
- Title: `text-xl` weight 600; description: `text-base text-muted`.
- Footer: right-aligned button group, `space-2` gap.

### 7.10 Popover

- Glass, `blur-md`, radius-md, padding `space-3`, max-width 320px.
- Arrow: 8px triangle, same fill as glass.
- Open animation: fade + scale-from-trigger-edge, 140ms.

### 7.11 Tooltip

- Smaller popover; `blur-sm`, radius-sm, `text-xs`, padding `space-2 space-2.5`.
- Delay open 400ms, delay close 100ms.
- No arrow on tooltips (kept minimal).
- Single-line; for multi-line use Popover.

### 7.12 Toast

- Glass, radius-md, padding `space-3 space-4`, `elev-3`.
- Layout: leading status icon, body (title + optional description), trailing X close button.
- Position: bottom-right desktop, top-center mobile.
- Auto-dismiss 5s (success/info), 8s (warning), persistent until dismissed (danger).
- Stack up to 3 visible; older slide off.
- Enter: `translateY(8px)` + opacity 0 → `translateY(0)` + opacity 1 with `ease-spring`.

### 7.13 Tabs

- Tabs list: horizontal, `space-1` gap between triggers.
- Trigger: `text-base`, padding `space-2 space-3`, color `text-muted` → `text-primary` on active.
- Active underline: 2px line in `var(--accent)`, 4px gap below text, animated slide using shared layout id (200ms).
- Content panel: `bare` card variant, padding `space-6 0`.

### 7.14 Checkbox

- 18×18px, radius-xs, border `1px var(--border-strong)`.
- Unchecked: surface background.
- Checked: `var(--accent)` background, white check icon.
- Indeterminate: `var(--accent)` background, white horizontal bar icon.
- Focus ring on container (4px round-rect at radius-sm).

### 7.15 Switch

- 32×18px track, radius-full.
- Off: track `hsl(var(--border-strong))`, thumb white at left.
- On: track `var(--accent)`, thumb white at right.
- Thumb 14×14px, 2px inset from track.
- Transition: 160ms `ease-out-quart` on track color and thumb translateX.

### 7.16 List item

The workhorse pattern.

```
+------------------------------------------------------------+
| [icon]  Title text                  meta-1   [tag] [tag]  >|
|         Subtitle / one-line summary                  meta-2|
+------------------------------------------------------------+
```

- Height: 56px default (dense list 44px).
- Padding `space-3 space-4`.
- Radius `radius-md`.
- Hover: background `hsl(var(--surface) / 0.5)` with `blur-sm` (mini-glass on hover), 120ms.
- Selected: background `hsl(var(--accent-soft))`, left border `2px var(--accent)`.
- Snoozed: opacity 0.7, snooze badge visible in meta-1 slot.
- Focus-visible (keyboard nav): focus ring on whole row.
- Chevron at far right appears on hover.

### 7.17 Tag chip

- Height 22px, radius-xs.
- Background `hsl(var(--surface-sunken) / 0.8)` with subtle `blur-sm`.
- Border `1px hsl(var(--border) / 0.6)`.
- Text `text-2xs`, weight 500, padding `space-1.5 space-2`.
- Optional leading Hash icon at 10px.
- Interactive variant has hover bg `hsl(var(--accent-soft))`.

### 7.18 Stage pill

Stage-specific colors mapped from semantic palette:

| Stage | Background | Text |
|---|---|---|
| `idea` | `hsl(var(--text-muted) / 0.15)` | `var(--text-muted)` |
| `prd` | `hsl(45 80% 60% / 0.18)` | `hsl(45 80% 40%)` (theme-adjusted) |
| `building` | `hsl(var(--accent-soft))` | `var(--accent)` |
| `review` | `hsl(280 60% 60% / 0.18)` | violet-tinted |
| `shipped` | `hsl(var(--success) / 0.18)` | `var(--success)` |
| `archived` | `hsl(var(--text-faint) / 0.15)` | `var(--text-faint)` |

Visual: small radius-xs pill, `text-2xs` uppercase weight 600 with `letter-spacing: 0.05em`, padding `space-1 space-2`, optional 6px filled circle at left in matching color.

### 7.19 Activity event row

```
[icon]  [timestamp]  [actor / system]  [event description]  [→ link]
```

- Compact `text-sm`, line-height 1.4.
- Icon at 12px, color-coded by event type (stage change = accent, build run = warning, note = muted).
- Timestamp `text-xs text-muted`, fixed 80px column.
- Description can wrap to 2 lines max; ellipsis after.

### 7.20 Stall badge

```
[⏱  Stalled 5d]
```

- Amber treatment when 1–7 days past threshold; red after 7+.
- Background `hsl(var(--warning) / 0.18)` (amber) or `hsl(var(--danger) / 0.18)` (red).
- Text matching warn/danger color, `text-2xs` weight 600.
- Optional pulsing dot at left (1.6s opacity 0.6→1 loop) for red-state only.

### 7.21 Snooze badge

```
[💤 Until Wed · waiting on PR review]
```

- Background `hsl(var(--text-faint) / 0.15)`.
- Text `text-muted`, `text-2xs` weight 500.
- Reason text in italic after middot.
- Truncates reason to 36 chars then ellipsis; full reason in tooltip.

### 7.22 Empty state pattern

Centered region with:
- Icon (32px, color `text-faint`).
- Title (`text-lg` weight 500, color `text-muted`).
- Description (`text-base text-muted`, max 360px width).
- Optional primary action button below.

Padding `space-12` vertical. No glass, no card — empty state lives directly on the surface.

### 7.23 Loading skeletons

- Background `hsl(var(--text-faint) / 0.12)`, radius matches the element being replaced.
- Shimmer: linear-gradient sweep at 0.06 opacity over the skeleton, 1400ms infinite linear.
- Replace specific UI shapes (line: 12px height; card: rectangle of card size; avatar: circle).

### 7.24 Command palette item

```
[icon]  Item label                 [type chip]   [⏎]
        Optional secondary text
```

- Height 44px.
- Hover / arrow-focused: bg `hsl(var(--accent-soft))`.
- Selected: same + visible focus ring.
- Type chip: tiny pill indicating Project / Goal / Note / Action / Nav, `text-2xs` weight 500.
- Trailing kbd `⏎` visible only on focused item.

### 7.25 Kbd component

Inline keyboard shortcut hint.
- Inline-flex, `font-mono`, `text-2xs`, weight 500.
- Padding `space-0.5 space-1`, height 18px.
- Background `hsl(var(--surface) / 0.8)`, border `1px var(--border)`, radius-xs.
- Color `text-muted`.

---

## 8. Screen specifications

ASCII layouts. Apply theme tokens; structure constant across themes unless noted.

### 8.1 Dashboard

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar: [⊕ Capture an idea, note, or topic...     ⌘N]      [☀][🔔][A] |
|         +--------------------------------------------------------------+---------+
|         |                                                                        |
|         |  Good evening, Adam.                                                   |
|         |  Tuesday · May 23                                                      |
|         |                                                                        |
|         |  +-----------------------------------------------------------------+   |
|         |  | MOMENTUM · last 7 days                                          |   |
|         |  |  ●  Compass build                  touched 12× · building       |   |
|         |  |  ●  Rust ownership model          touched  7× · in-progress     |   |
|         |  |  ●  Read: Designing Data...       touched  4× · reading         |   |
|         |  |  ●  Coyote analyzer               touched  3× · building         |   |
|         |  |  ●  Korean N3 grammar             touched  2× · in-progress     |   |
|         |  +-----------------------------------------------------------------+   |
|         |                                                                        |
|         |  +-------------------------------+ +-----------------------------+    |
|         |  | NEEDS ATTENTION         (3)   | | THIS WEEK              (4)  |    |
|         |  | ⏱ Stalled 5d                  | | ⊠ Compass v1 ship         |    |
|         |  |  ⊠ Tax filing automation      | |    target Fri, in 3 days   |    |
|         |  |  ⊠ Practice ear training      | | ✦ Finish chapter 7        |    |
|         |  |  ✦ Read: SICP                 | |    target Thu, in 2 days   |    |
|         |  | [View all stalled →]          | | [View all →]              |    |
|         |  +-------------------------------+ +-----------------------------+    |
|         |                                                                        |
|         |  +-----------------------------------------------------------------+   |
|         |  | COUNTS                                                          |   |
|         |  |   12 projects        4 building  3 review  3 idea  2 shipped    |   |
|         |  |    8 goals           5 active    2 curious  1 done              |   |
|         |  |   23 inbox           captures waiting to be filed               |   |
|         |  +-----------------------------------------------------------------+   |
+----------------------------------------------------------------------------------+
```

- Momentum strip: horizontally scrollable on narrow viewports; each row shows a leading status dot in accent, title, touch count, and current stage/status pill.
- Needs attention: cards with title, stall badge, leading icon by entity type. "View all stalled" navigates to filtered list.
- This week: same structure with target-date string in muted text.
- Counts: single card with three stat rows. Stat numbers `text-3xl` Display weight 700, labels `text-xs uppercase text-muted`.

Theme variation: Outer Space gets a faint nebula bloom behind the momentum card; White Sand gets a horizon line behind the dashboard heading.

### 8.2 Inbox

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar (capture input)                                                |
|         +---------------------------------------------------------+--------------+
|         |  Inbox                                          23 items              |
|         |  Unfiled captures · file them into a project or learning goal         |
|         |  ---                                                                  |
|         |  [Filter: all / today / this week ▾]   [Sort: newest ▾]              |
|         |  ---                                                                  |
|         |  +-------------------------------------------------------------------+|
|         |  | ⊕ "use cmdk for the palette, not headlessui"        2m ago    [⋯]||
|         |  |   #compass                            [→ File...] [Edit] [Delete]||
|         |  +-------------------------------------------------------------------+|
|         |  | ⊕ "look into structured-clone for snapshotting state"  18m ago [⋯]||
|         |  |   no tags                                                         ||
|         |  +-------------------------------------------------------------------+|
|         |  | ⊕ "great talk: Andy Matuschak on note-taking"          1h ago [⋯]||
|         |  |   #learning #tools           [→ Promote to learning goal]        ||
|         |  +-------------------------------------------------------------------+|
|         |  ...                                                                  |
+----------------------------------------------------------------------------------+
```

- Each row is a List Item.
- "File..." action opens a popover with a `cmdk` filter to select destination (Project or Learning Goal). Pressing Enter files and removes from inbox.
- Type chip on right indicates inferred type (Idea / Note / Curiosity).
- Empty state: "Your inbox is empty. New captures land here for filing." with a leading Inbox icon.

### 8.3 Projects list

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +--------------------------------------------------------------+---------+
|         |  Projects                                       12 active  [+ New]    |
|         |  ---                                                                  |
|         |  [Filter: stage ▾]  [Tag ▾]  [Sort: last-touched ▾]   [⊞ List | ▦]   |
|         |  ---                                                                  |
|         |  +-----------------------------------------------------------------+ |
|         |  | TITLE                          STAGE       LAST     SNZ  TAGS    | |
|         |  |---------------------------------------------------------------- | |
|         |  | Compass v1                    [BUILDING]   2m      —    compass | |
|         |  | Coyote analyzer               [PRD]        2h      —    rust    | |
|         |  | Tax filing automation         [IDEA]       5d  [⏱5d] —   ops    | |
|         |  | Stove timer hardware          [REVIEW]     1d  —   [💤Wed] iot  | |
|         |  | Old portfolio site            [ARCHIVED]   12d  —    —   web    | |
|         |  | ...                                                              | |
|         |  +-----------------------------------------------------------------+ |
+----------------------------------------------------------------------------------+
```

- Dense table layout. Column widths: title flex, stage 110px, last 80px, snooze/stall 100px, tags flex (max 3 visible + count).
- Rows are List Items (dense 44px variant).
- Header row in `surface-sunken`, `text-2xs uppercase text-muted`.
- Click row opens detail; hover shows trailing chevron and a quick-actions popover button on hover.

### 8.4 Project detail

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +--------------------------------------------------------------+---------+
|         |  [< Projects]                                                          |
|         |                                                                        |
|         |  Compass v1                                            [⋯ Actions]    |
|         |  [BUILDING]  ●  last touched 2 minutes ago  ·  #compass #ai-tools     |
|         |                                                                        |
|         |  +--------------------------------+ +-------------------------------+ |
|         |  | SUMMARY                        | | LINKS                         | |
|         |  | A personal dashboard for       | | • repo · github.com/.../...   | |
|         |  | tracking projects, learning,   | | • deploy · compass.fly.dev    | |
|         |  | and notes.                     | | • prd · /docs/prd.md          | |
|         |  +--------------------------------+ +-------------------------------+ |
|         |                                                                        |
|         |  [ Notes | Build runs | Activity ]                                    |
|         |  ---                                                                  |
|         |  (Notes tab content)                                                   |
|         |   • cmdk has a built-in matcher       Today                           |
|         |   • dual-DB drizzle setup notes...    Yesterday                       |
|         |   • [+ Add note]                                                      |
+----------------------------------------------------------------------------------+
```

- Header: project title `text-3xl`, stage pill, status dot, last touched, tags.
- Summary card (left, 60%) and Links card (right, 40%) above the fold.
- Tabs: Notes (default) / Build runs / Activity.
  - Notes tab: list of attached notes with timestamps, plus inline add input.
  - Build runs: chronological list with status (queued/running/completed/failed), objective, links to PR/deploy.
  - Activity: full activity event log.
- Actions menu: edit, change stage, snooze, archive, delete.

### 8.5 Learning list

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +--------------------------------------------------------------+---------+
|         |  Learning                                       8 active  [+ New]     |
|         |  Topics + reading list                                                |
|         |  ---                                                                  |
|         |  [Status ▾] [Tag ▾] [Sort ▾]                       [Topics | Reading] |
|         |  ---                                                                  |
|         |  +-----------------------------------------------------------------+ |
|         |  | TOPIC                  STATUS       PROGRESS    READS  LAST     | |
|         |  |---------------------------------------------------------------- | |
|         |  | Rust ownership model   [IN PROG]   ████░░ 4/7   2/5    2h       | |
|         |  | Korean N3 grammar      [IN PROG]   ██░░░░ 2/8   1/3    1d       | |
|         |  | LLM eval methods       [CURIOUS]   ░░░░░░ 0/0   0/2    7d  [⏱7d]| |
|         |  | CRDTs                  [DONE]      ██████ 5/5   3/3    23d      | |
|         |  +-----------------------------------------------------------------+ |
+----------------------------------------------------------------------------------+
```

- Columns: topic flex, status 110px, progress bar 130px (with N/M ratio), reads 60px, last 80px, snooze/stall flex.
- Toggle at top right: "Topics | Reading" switches between the topic list and the nested reading list view.

### 8.6 Learning detail

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +--------------------------------------------------------------+---------+
|         |  [< Learning]                                                          |
|         |                                                                        |
|         |  Rust ownership model                                  [⋯ Actions]    |
|         |  [IN PROGRESS]  ●  4/7 done · #rust #systems-prog                     |
|         |                                                                        |
|         |  Motivation                                                            |
|         |  Want to internalize the borrow checker so it stops fighting me.       |
|         |                                                                        |
|         |  [ Checklist | Resources | Notes | Activity ]                          |
|         |  ---                                                                  |
|         |  Checklist                                                             |
|         |   [x] Understand move semantics                                        |
|         |   [x] Distinguish &T vs &mut T                                         |
|         |   [x] Read chapter 4 of TRPL                                           |
|         |   [x] Write a small project using Rc<RefCell<T>>                       |
|         |   [ ] Read Nomicon ch. 3                                               |
|         |   [ ] Implement a linked list                                          |
|         |   [ ] Watch Crust of Rust: Smart Pointers                              |
|         |   [+ Add checklist item]                                               |
+----------------------------------------------------------------------------------+
```

- Tabs: Checklist (default) / Resources / Notes / Activity.
- Resources tab: nested reading list filtered to items attached to this goal. Allows attach existing or add new.
- Each checklist item is a Checkbox + label; hover shows drag handle (week 2+ reorder; placeholder dragless in week 1).

### 8.7 Reading list view (nested under Learning)

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +--------------------------------------------------------------+---------+
|         |  [< Learning] Reading                          43 items  [+ Add]      |
|         |  ---                                                                  |
|         |  [Status: all / to-read / reading / read / abandoned ▾]               |
|         |  [Type: all / article / book / paper / video / course / other ▾]      |
|         |  ---                                                                  |
|         |  +-----------------------------------------------------------------+ |
|         |  | TITLE                                  TYPE     STATUS    GOAL    | |
|         |  |---------------------------------------------------------------- | |
|         |  | Designing Data-Intensive Applications  [BOOK]   [READING] systems| |
|         |  | The Bitter Lesson                      [ART]    [READ]    llm    | |
|         |  | Crafting Interpreters (ch. 12)         [BOOK]   [TO-READ] —      | |
|         |  | Phoenix on Cardamom (talk)             [VID]    [ABNDND]  —      | |
|         |  +-----------------------------------------------------------------+ |
+----------------------------------------------------------------------------------+
```

- Dense list (44px row).
- Click row opens an inline panel (sheet from right, 480px wide) with details: source URL, author, type, status, rating, linked goal, takeaways note.

### 8.8 Settings

```
+----------------------------------------------------------------------------------+
| Sidebar | Top bar                                                                |
|         +--------------------------------------------------------------+---------+
|         |  Settings                                                              |
|         |  ---                                                                  |
|         |  [ Appearance | Notifications | Capture | Account | Tokens ]           |
|         |  ---                                                                  |
|         |  Appearance                                                            |
|         |                                                                        |
|         |  THEME                                                                 |
|         |  +--------+ +--------+ +--------+ +--------+ +--------+               |
|         |  | white  | | dark   | | outer  | | sand   | | forest |               |
|         |  | minimal| | minimal| | space  | | beach  | |        |               |
|         |  | [✓]    | |        | |        | |        | |        |               |
|         |  +--------+ +--------+ +--------+ +--------+ +--------+               |
|         |   Currently active: White Minimal                                      |
|         |   Live preview applied immediately. Persisted to your account.         |
|         |                                                                        |
|         |  DENSITY                                                               |
|         |   ( ) Comfortable   (●) Compact (default)   ( ) Dense                  |
|         |                                                                        |
|         |  ---                                                                  |
|         |  Notifications                                                         |
|         |                                                                        |
|         |  Telegram  [On  ◐ ]                                                    |
|         |   Bot reuses your existing OpenClaw token. Chat ID: 8756412374.        |
|         |                                                                        |
|         |  QUIET HOURS                                                           |
|         |   From [22:00] to [07:00]   timezone America/Chicago                   |
|         |                                                                        |
|         |  PER-TRIGGER                                                           |
|         |   [✓] Daily digest             at [09:00]                              |
|         |   [✓] Stall alerts             threshold projects [3d] goals [2d]      |
|         |   [✓] Build run completion                                             |
+----------------------------------------------------------------------------------+
```

- Theme thumbnails: 96×72px cards each showing a miniaturized preview (background, one card, one button) of that theme. Active theme has check overlay and accent border.
- Toggling theme applies immediately (instant token swap + 320ms ambient cross-fade).
- Density: radio group; affects spacing scale multiplier (Comfortable 1.15×, Compact 1.0×, Dense 0.9×).
- Notifications tab: Switch components for each toggle, time-picker inputs.
- Tokens tab (Account or separate tab): list of issued bearer tokens (CLI, helper, webhook) with last-used dates and a Revoke action.

### 8.9 Capture modal (⌘N global)

```
                  +-------------------------------------------+
                  | Capture                              [Esc]|
                  +-------------------------------------------+
                  |  /idea  /note  /curious  /todo            |
                  |                                           |
                  |  [____________________________________]   |
                  |   Quickly capture an idea, note, or       |
                  |   curiosity. Type a slash to set the kind.|
                  |                                           |
                  |  Lands in Inbox · #unfiled                |
                  |                                           |
                  |       [Cancel]      [Capture  ⏎]          |
                  +-------------------------------------------+
```

- Dialog, 520px wide.
- Single text input with auto-detect for `/idea`, `/note`, `/curious`, `/todo` prefixes. If prefix is detected, it's rendered as a chip at the input's start and stripped from value on submit.
- Enter to capture, Esc to dismiss.
- Shows the type chip badge live as user types.
- Lands by default in Inbox; modal does not require selecting destination.
- Successful capture closes modal and fires success toast "Captured to Inbox · [open]".

### 8.10 Command palette (⌘K)

```
                  +--------------------------------------------------+
                  |  🔍  Search Compass or run a command...           |
                  +--------------------------------------------------+
                  |  Recent                                          |
                  |   • Compass v1                  [PROJECT]    ⏎  |
                  |   • Rust ownership model        [GOAL]          |
                  |                                                  |
                  |  Navigate                                        |
                  |   ⇥ Dashboard                   [NAV]            |
                  |   ⇥ Inbox                       [NAV]    23     |
                  |   ⇥ Projects                    [NAV]    12     |
                  |                                                  |
                  |  Actions                                         |
                  |   + Capture an idea             [ACTION]   ⌘N   |
                  |   ⏱ Snooze current item         [ACTION]        |
                  |   ☀ Switch theme...             [ACTION]        |
                  |                                                  |
                  |  Search results: "rust"                          |
                  |   • Rust ownership model        [GOAL]    97%   |
                  |   • Note: rust generics quirks  [NOTE]    71%   |
                  +--------------------------------------------------+
                  |  ↑↓ navigate     ⏎ open     esc close            |
                  +--------------------------------------------------+
```

- Dialog, 640px wide, top-positioned 15% from top of viewport.
- Built on `cmdk`. Sections: Recent, Navigate, Actions, Search results (only appears when query is non-empty).
- Active row: bg `hsl(var(--accent-soft))`.
- Footer: kbd hints, glass treatment.

---

## 9. Density modes

A single user-level setting in Settings → Appearance. Applies as a CSS variable multiplier on spacing tokens.

| Mode | Multiplier | Use case |
|---|---|---|
| Comfortable | 1.15× | Larger monitors, accessibility |
| Compact (default) | 1.00× | Standard |
| Dense | 0.9× | Power user, small viewport |

Density affects `space-*` tokens but NOT `text-*`, `radius-*`, or component heights (those have fixed pixel relationships).

---

## 10. Layout breakpoints

| Name | Min width | Notes |
|---|---|---|
| `sm` | 640px | Mobile capture, single-column |
| `md` | 768px | Tablet, sidebar collapsed |
| `lg` | 1024px | Desktop, full sidebar |
| `xl` | 1280px | Wide desktop, default target |
| `2xl` | 1536px | Ultra-wide, content max 1440px centered |

Below `lg`: sidebar collapses to 56px icons; top bar capture input shrinks to icon-only `⊕`; cards stack single-column.

---

## 11. Accessibility

- All interactive elements have visible focus rings (`focus-visible` only — no rings on mouse interactions).
- Color contrast: text-primary ≥ 7:1, text-muted ≥ 4.5:1, all states tested per theme.
- `prefers-reduced-motion` respected (see §5.3).
- `prefers-color-scheme: dark` defaults first-run to Dark Minimal instead of White Minimal when no user preference exists.
- All Radix primitives ship with proper roles, labels, keyboard handling; do not break them with custom event handlers.
- Keyboard shortcuts:

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘N` / `Ctrl+N` | Open capture modal |
| `⌘,` / `Ctrl+,` | Open settings |
| `Esc` | Close any modal / popover |
| `/` | Focus search (when not in input) |
| `j` / `k` | List navigation (next / prev) |
| `Enter` | Open selected list item |
| `g d` | Go to Dashboard |
| `g i` | Go to Inbox |
| `g p` | Go to Projects |
| `g l` | Go to Learning |
| `g s` | Go to Settings |

---

## 12. Implementation reference table

What an engineer should pull on day one:

| Need | Source |
|---|---|
| Token values per theme | §1 |
| Glass material composition | §1 + §7.5 |
| Component visual + states | §7 |
| Screen layouts | §8 |
| Motion timings | §5 |
| Typography scale | §2 |
| Spacing scale | §3 |
| Icon set | §6 |
| Radix primitives needed | §7.1 |
| Keyboard shortcuts | §11 |
| Accessibility contract | §11 |
| Breakpoints | §10 |

### 12.1 First-day build order

1. Set up Tailwind config with custom color function reading from CSS variables.
2. Create `globals.css` with `:root[data-theme="..."]` for all 5 themes.
3. Build the `.glass` utility class.
4. Build typography styles and load Inter / JetBrains Mono via `next/font`.
5. Build App shell (Sidebar + Top bar) — this exercises glass, sidebar nav, top bar capture, and theme switcher in one screen.
6. Build core primitives in order: Button, Input, Kbd, Card, Tag chip, Stage pill, List item.
7. Build Radix-backed: Dialog, Popover, Tooltip, Toast, Tabs, Select, Checkbox, Switch.
8. Build `cmdk`-backed Command palette and Capture modal.
9. Build Dashboard, then Inbox (these exercise every primitive).
10. Project list → Project detail → Learning list → Learning detail → Reading list → Settings.

### 12.2 Theme switcher component

Lives in top bar right cluster. Click opens a Popover with five 96×72 theme thumbnails (rendered miniatures). Click a thumbnail: sets `localStorage['compass-theme']`, updates `:root[data-theme]`, persists to user settings via server action. Active theme has a check overlay and accent-tinted border.

### 12.3 Non-goals for design v1

Explicitly out of scope for this spec; do not invent:
- Animated ambient layers (stars twinkling, dust drifting, waves) — week 2+
- Per-theme custom font choices — Inter everywhere in v1
- Per-component theme overrides (e.g., "danger button looks different on Outer Space") — semantic tokens carry it
- Mobile-specific visual treatments beyond responsive collapse
- Print stylesheet
- High-contrast variant (relies on OS contrast settings + existing token ratios)

---

## 13. Glossary

| Term | Definition |
|---|---|
| Capture | The act of creating an unfiled entry (idea / note / curiosity / todo). Lands in Inbox by default. |
| File | The act of moving a capture from Inbox to a Project or Learning Goal. |
| Stall | Entity not touched within its threshold (3d projects, 2d goals). Surfaces in Needs Attention + fires Telegram alert. |
| Snooze | Explicit pause on stall clock with reason text and duration. |
| Glass | The translucent surface material — base color + alpha + blur + saturation + border + inner highlight + outer shadow. |
| Stage | Lifecycle position of a Project (idea / prd / building / review / shipped / archived). |
| Status | Lifecycle position of a Learning Goal (curious / in-progress / completed / parked). |
| Touched | Any write to an entity updates `last_touched_at`. |

---

**End of specification.**
