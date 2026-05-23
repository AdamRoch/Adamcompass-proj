import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.ts', '**/__tests__/**/*.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/src-tauri/**',
      '**/playwright/**',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/migrations/**',
        '**/*.config.*',
        '**/__tests__/**',
        'apps/helper/**',
      ],
    },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: [
      // Deep imports first (longest prefix wins in vitest's alias matcher).
      {
        find: /^@compass\/shared\/zod$/,
        replacement: new URL('./packages/shared/src/zod.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/db\/queries\/(.+)$/,
        replacement: `${new URL('./packages/db/src/queries/', import.meta.url).pathname}$1.ts`,
      },
      {
        find: /^@compass\/db\/queries$/,
        replacement: new URL('./packages/db/src/queries/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/db\/schema\/sqlite$/,
        replacement: new URL('./packages/db/src/schema/sqlite.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/db\/schema\/pg$/,
        replacement: new URL('./packages/db/src/schema/pg.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/db\/schema$/,
        replacement: new URL('./packages/db/src/schema/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/db\/touch$/,
        replacement: new URL('./packages/db/src/touch.ts', import.meta.url).pathname,
      },
      // Top-level package roots.
      {
        find: /^@compass\/shared$/,
        replacement: new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/db$/,
        replacement: new URL('./packages/db/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/search$/,
        replacement: new URL('./packages/search/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/notifications$/,
        replacement: new URL('./packages/notifications/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/scheduler$/,
        replacement: new URL('./packages/scheduler/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@compass\/api-client$/,
        replacement: new URL('./packages/api-client/src/index.ts', import.meta.url).pathname,
      },
      // Next.js App Router `@/*` alias (apps/web/tsconfig.json paths) — used by route handlers
      // to resolve `@/lib/...`. Vitest doesn't read tsconfig paths, so we mirror it here.
      {
        find: /^@\/(.+)$/,
        replacement: `${new URL('./apps/web/', import.meta.url).pathname}$1`,
      },
      // `server-only` is a no-op marker package in Next; for Node tests we provide an empty stub
      // so route-handler imports don't fail at the module-load boundary.
      {
        find: /^server-only$/,
        replacement: new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
      },
      // `next/headers` calls require an active request context (AsyncLocalStorage). For Node-side
      // integration tests we substitute a simple in-memory mock backed by a Map.
      {
        find: /^next\/headers$/,
        replacement: new URL('./tests/stubs/next-headers.ts', import.meta.url).pathname,
      },
    ],
  },
});
