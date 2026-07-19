#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Dependency-free PWA icon generator: rasterizes the Compass brand mark (accent disc +
// white needle, matching public/favicon.svg) straight to PNG via zlib. Regenerate with:
//   node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/public');

// hsl(217 92% 52%) — the white_minimal theme accent.
function hslToRgb(h, sPct, lPct) {
  const s = sPct / 100;
  const l = lPct / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const ACCENT = hslToRgb(217, 92, 52);
const ACCENT_DEEP = hslToRgb(217, 92, 40);
const WHITE = [255, 255, 255];
const SOUTH = hslToRgb(217, 60, 82);

// Point-in-triangle via sign tests.
function inTri(px, py, [x1, y1], [x2, y2], [x3, y3]) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Color of one sample point in unit space (0..1, y down), or null for background. */
function sample(u, v) {
  const cx = 0.5;
  const cy = 0.5;
  const d = Math.hypot(u - cx, v - cy);
  // Needle geometry — inside the inner 80% safe area for maskable cropping.
  const north = [
    [0.5, 0.16],
    [0.585, 0.5],
    [0.415, 0.5],
  ];
  const south = [
    [0.5, 0.84],
    [0.585, 0.5],
    [0.415, 0.5],
  ];
  if (Math.hypot(u - cx, v - cy) < 0.035) return ACCENT_DEEP; // hub dot
  if (inTri(u, v, ...north)) return WHITE;
  if (inTri(u, v, ...south)) return SOUTH;
  if (d > 0.3 && d < 0.325) return WHITE; // ring
  // Full-bleed accent background with a soft radial deepening toward the edge.
  const t = Math.min(1, d / 0.72);
  return ACCENT.map((c, i) => Math.round(c + (ACCENT_DEEP[i] - c) * t * t));
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 3; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const [cr, cg, cb] = sample(u, v);
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      px[o] = Math.round(r / n);
      px[o + 1] = Math.round(g / n);
      px[o + 2] = Math.round(b / n);
      px[o + 3] = 255;
    }
  }
  return px;
}

// ---- minimal PNG encoder ----
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const file = resolve(OUT, name);
  writeFileSync(file, encodePng(size, drawIcon(size)));
  console.log(`wrote ${file} (${size}x${size})`);
}
