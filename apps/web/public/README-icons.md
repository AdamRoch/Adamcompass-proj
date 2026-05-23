# PWA icons — placeholders

The two files `icon-192.png` and `icon-512.png` in this directory are **1x1 transparent PNG placeholders**. They exist so the Web App Manifest (`/manifest.webmanifest`) resolves on install without 404s, but they are not production-quality assets.

## What to replace them with

Before any real install / app-store-like listing:

- `icon-192.png` — a 192x192 PNG, square, with safe-area padding (~10%) for maskable icons.
- `icon-512.png` — a 512x512 PNG, same artwork.

Both icons are declared with `"purpose": "any maskable"` in the manifest, so the source artwork must look correct when cropped to a circle / squircle / rounded-rect. Keep the core mark inside the inner 80%.

## Suggested artwork

The temporary `favicon.svg` (a stylized compass needle on a circle outline, monochrome via `currentColor`) is the source of truth for the brand mark. The PNG icons should render that same needle filled in the active theme accent over the theme background.

## How to regenerate

Any vector tool (Figma, Sketch, Inkscape, even rsvg-convert + ImageMagick) will work:

```sh
# Example with rsvg-convert + ImageMagick
rsvg-convert -w 192 -h 192 favicon.svg | magick - icon-192.png
rsvg-convert -w 512 -h 512 favicon.svg | magick - icon-512.png
```

When replacing, drop the new PNGs into this directory with the same filenames — the manifest references them by path.
