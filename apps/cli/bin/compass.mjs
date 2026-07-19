#!/usr/bin/env node
import { spawn } from 'node:child_process';
// Thin shim: prefer the compiled JS, fall back to running the TS source via tsx for dev.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const built = resolve(here, '..', 'dist', 'index.js');
const src = resolve(here, '..', 'src', 'index.ts');

if (existsSync(built)) {
  await import(pathToFileURL(built).href);
} else if (existsSync(src)) {
  // Dev: re-exec ourselves with `node --import tsx` so the TS source is loadable.
  // We re-exec rather than register tsx in-process to keep this shim small + portable
  // across tsx versions (the programmatic register API has shifted between releases).
  const child = spawn(process.execPath, ['--import', 'tsx', src, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
  child.on('error', (err) => {
    console.error('compass: failed to spawn dev runtime (tsx).');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else {
  console.error('compass: no built artifact (dist/index.js) and no src/index.ts found.');
  console.error(
    'Run `pnpm --filter @compass/cli build` first, or `pnpm --filter @compass/cli dev` for dev.',
  );
  process.exit(1);
}
