import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Tauri 2 expects the frontend to ship a static bundle. We use multi-page mode
// so the popover and settings windows can load independent HTML entrypoints
// (cheaper to hide/show than one SPA with route-based mounting), while still
// sharing one Vite dev server during `tauri dev`.
//
// Tauri injects TAURI_ENV_* env vars at build/dev time; we mirror the
// "host + strict port" recipe from the official template so HMR works inside
// the WebView.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri's Rust build watches src-tauri itself; don't double-watch.
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      input: {
        popover: resolve(__dirname, 'popover.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
}));
