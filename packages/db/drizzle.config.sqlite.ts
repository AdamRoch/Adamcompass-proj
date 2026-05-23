import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/sqlite.ts',
  out: './migrations/sqlite',
  dbCredentials: {
    url: process.env.COMPASS_SQLITE_PATH ?? './data/compass.db',
  },
  verbose: true,
  strict: true,
});
