# PWA icons

`icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` are real rendered assets:
the Compass brand mark (white needle + ring on the accent-blue disc, matching
`favicon.svg`) with the core mark inside the inner 80% so `"purpose": "any maskable"`
crops (circle / squircle / rounded-rect) stay correct.

## Regenerating

The generator is dependency-free (zlib PNG encoder + supersampled rasterizer):

```bash
node scripts/gen-icons.mjs
```

Adjust colors/geometry in `scripts/gen-icons.mjs` (`sample()` draws in unit space).
`favicon.svg` remains the vector source of truth for the mark.
