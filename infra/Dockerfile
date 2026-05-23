# Multi-stage build for the Compass Next.js web app + workspace packages.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json turbo.json tsconfig.base.json biome.json ./
COPY apps/web/package.json apps/web/
COPY apps/cli/package.json apps/cli/
COPY apps/helper/package.json apps/helper/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/search/package.json packages/search/
COPY packages/notifications/package.json packages/notifications/
COPY packages/scheduler/package.json packages/scheduler/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm install --frozen-lockfile --filter=@compass/web... --filter=@compass/db... --filter=@compass/scheduler... --filter=@compass/notifications... --filter=@compass/search... --filter=@compass/shared... --filter=@compass/api-client...

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile --offline || pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @compass/web build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Fetch litestream for SQLite continuous replication (no-op when COMPASS_DB_DIALECT=pg)
ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.deb /tmp/litestream.deb
RUN dpkg -i /tmp/litestream.deb && rm /tmp/litestream.deb

COPY --from=build /app/apps/web/.next /app/apps/web/.next
COPY --from=build /app/apps/web/public /app/apps/web/public
COPY --from=build /app/apps/web/package.json /app/apps/web/package.json
COPY --from=build /app/apps/web/next.config.mjs /app/apps/web/next.config.mjs
COPY --from=build /app/apps/web/instrumentation.ts /app/apps/web/instrumentation.ts
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/packages /app/packages
COPY infra/litestream.yml /etc/litestream.yml
COPY infra/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000
VOLUME ["/data"]
CMD ["/app/start.sh"]
