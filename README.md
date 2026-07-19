# Compass

A single-user personal dashboard for **projects, learning, and notes** with frictionless capture from web, CLI, mobile (PWA), and a global hotkey.

> [V2 PRD](docs/Compass-V2-PRD.md) · [Implementation PRD](docs/Compass-Implementation-PRD.md) · [Product PRD](Compass-PRD.md) · [Design spec](design/01-ui-themes-spec.md) · [Architecture decisions](docs/decisions/)

## What's in v2

Everything below in v1, plus: **milestones** with derived progress (and seeding from the in-app
**PRD editor**), first-class **notes** (edit/delete anywhere + `/notes`), explicit
**archive/restore**, **tag management** (rename/merge/delete), a **kanban board** over project
stages, the **curiosity → learning goal** promotion flow, **build-run queueing** with a dashboard
**overnight summary** (webhook accepts human project slugs; `scripts/simulate-run.ts` stands in
for the agent), a global **/activity** feed with cursor pagination, real **PWA icons**, and a
motion pass across the UI. Status + verification: [`BUILD_STATUS.md`](BUILD_STATUS.md).

## What's in v1

Capture from any surface lands in a unified **Inbox**. From there it's filed into a **Project** (with lifecycle stages + snooze) or a **Learning Goal** (with checklists + a reading list). The **Dashboard** surfaces momentum (last 7 days touched) and stalls (configurable per entity, default 3d for projects / 2d for goals). A **Telegram** integration delivers a daily digest and stall alerts; quiet hours respected.

The agentic-coding workflow contract is **designed and stubbed** (`POST /webhooks/v1/runs/events` with bearer + HMAC + idempotency); when an agent comes online, no code changes needed.

The three demoable flows (PRD §1.3) are the v1-done bar:

1. Capture from web → file from Inbox → Dashboard reflects momentum + stall clock.
2. Capture from CLI → that evening's daily Telegram digest fires.
3. `curl` POST a sample run event → `activity_event` written → Dashboard reflects the run.

## Quickstart

Requires **Node 22+**, **pnpm 9+**, **macOS or Linux** (Windows-friendly server-side; Tauri helper is mac-only for week 1).

```bash
corepack enable
pnpm install

# Copy env and edit secrets (at minimum: COMPASS_SESSION_SECRET, COMPASS_WEBHOOK_HMAC_SECRET)
cp .env.example .env.local

# Apply migrations + seed the settings singleton
pnpm db:migrate

# To create the first user, set this env var before signing in (bootstrap is opt-in):
echo "COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=1" >> .env.local

# Run the web app — http://localhost:3000
pnpm web
```

Visit `/login`, submit any email + password — bootstrap creates the user and signs you in.

### CLI

```bash
# Build the CLI binary (needs bun, falls back to node+tsx in dev)
pnpm --filter @compass/cli build
node apps/cli/bin/compass.mjs login      # device-code flow
node apps/cli/bin/compass.mjs capture "ship the auth changes"
node apps/cli/bin/compass.mjs status
```

### Tauri menubar helper (macOS only week 1)

```bash
pnpm --filter @compass/helper tauri dev
# After paired and approved via `compass login`-style device-code flow,
# Alt+Space pops the capture window from anywhere.
```

## Repo layout

```
apps/
  web/        Next.js App Router web app — UI + API + webhooks + scheduler
  cli/        compass CLI binary (capture / login / list / status)
  helper/     Tauri menubar app (global hotkey + capture popover)
packages/
  db/         Drizzle schema + queries + migrations (SQLite + Postgres)
  shared/     types, ULID, time, Zod schemas, error classes
  search/     SearchProvider + FTS5 (SQLite) + tsvector (Postgres) impls
  notifications/  NotificationProvider + Telegram delivery, quiet-hours, drain
  scheduler/  node-cron wrapper, daily digest + stall sweeper
  api-client/ typed SDK shared by CLI / helper / future agents
infra/        Fly.io config, Litestream config, Dockerfile, start.sh
docs/         Implementation PRD + decision documents
design/       UI design spec (5 themes) + implementation reference
tests/        Vitest setup + Playwright E2E specs
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps in dev (parallel via Turbo) |
| `pnpm web` | Run web app only |
| `pnpm cli <args>` | Forward args to CLI dev mode |
| `pnpm helper` | Run Tauri helper in dev |
| `pnpm build` | Build all apps + packages |
| `pnpm typecheck` | TS typecheck across the workspace |
| `pnpm test` | Vitest (unit + integration) |
| `pnpm test:e2e` | Playwright smoke tests |
| `pnpm lint` / `pnpm lint:fix` | Biome lint |
| `pnpm db:generate` | Regenerate Drizzle migrations from schema |
| `pnpm db:migrate` | Apply migrations to the active dialect |
| `pnpm db:push:sqlite` / `pnpm db:push:pg` | Push schema directly (dev only) |

## Dual-DB

Compass runs against either **SQLite** (default, with Litestream continuous replication) or **Postgres** (e.g. Neon, Fly Postgres). Switch via `COMPASS_DB_DIALECT=sqlite|pg`. Per-dialect Drizzle schemas + migration sets are maintained; CI runs both paths.

```bash
# SQLite (default)
COMPASS_DB_DIALECT=sqlite COMPASS_SQLITE_PATH=./data/compass.db pnpm db:migrate

# Postgres
COMPASS_DB_DIALECT=pg DATABASE_URL=postgres://compass:compass@localhost:5432/compass pnpm db:migrate
```

Search abstraction sits behind `@compass/search`: FTS5 for SQLite, tsvector + GIN for Postgres. Single `SearchProvider` interface; pick at boot.

## Environment matrix

See [`.env.example`](.env.example) for the full list. Required for first run:

| Variable | Required when | Notes |
|---|---|---|
| `COMPASS_DB_DIALECT` | always | `sqlite` (default) or `pg` |
| `COMPASS_SQLITE_PATH` | dialect=sqlite | e.g. `./data/compass.db` |
| `DATABASE_URL` | dialect=pg | Postgres connection string |
| `COMPASS_SESSION_SECRET` | always | 32+ random chars |
| `COMPASS_WEBHOOK_HMAC_SECRET` | always | 32+ random chars |
| `COMPASS_TOKEN_PEPPER` | always | 16+ random chars — pepper for token hashing |
| `COMPASS_BASE_URL` | always | e.g. `http://localhost:3000` |
| `COMPASS_TZ` | optional | default `America/Chicago` |
| `COMPASS_BOOTSTRAP_ALLOW_FIRST_USER` | first-time setup | `1` to allow the first signup form to create the user account |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | notifications | reuses your existing OpenClaw Telegram bot, or mint a new one |
| `LITESTREAM_REPLICA_URL` + AWS keys | SQLite in prod | continuous backup to R2/S3 |

## Architecture quick map

- **Three thin clients + one server.** Web (browser + PWA on mobile) + CLI binary + native menubar helper. All hit a single deployed server with cookie session (browser) or bearer token (others).
- **Auth principals: 3 token scopes + 1 cookie.** `cli`, `helper`, `webhook` token scopes. Webhook adds HMAC body signature on top of bearer.
- **Server-authoritative.** No sync engines; clients have local outboxes that replay on reconnect. Idempotency keys per capture protect against double-fires.
- **Polymorphic activity event log.** Single `activity_event` table powers the dashboard, momentum, stall detection, and Telegram digest. `last_touched_at` is denormalized convenience updated on any write (PRD §10.1).
- **5 themes, runtime-switchable.** White minimal (default) / dark minimal / outer space / white sand beach / dark forest. CSS-variable token system, glass material spec, Radix primitives + custom design.

## Deploy (Fly.io)

```bash
fly launch --copy-config --config infra/fly.toml
fly volumes create compass_data --region ord --size 10
fly secrets set \
  COMPASS_SESSION_SECRET=$(openssl rand -base64 32) \
  COMPASS_WEBHOOK_HMAC_SECRET=$(openssl rand -base64 32) \
  COMPASS_TOKEN_PEPPER=$(openssl rand -base64 24) \
  TELEGRAM_BOT_TOKEN=... \
  TELEGRAM_CHAT_ID=... \
  LITESTREAM_REPLICA_URL=s3://your-bucket/compass \
  LITESTREAM_ACCESS_KEY_ID=... \
  LITESTREAM_SECRET_ACCESS_KEY=...
fly deploy
```

The container restores from Litestream if the local volume is empty, applies migrations, then runs Litestream-wrapped Next.js (continuous backup while serving).

## Webhook contract

```http
POST /webhooks/v1/runs/events
Authorization: Bearer <webhook-token>
X-Compass-Signature: sha256=<hex>
Content-Type: application/json

{
  "run_id":       "01HSC4Y3FAKERUNULIDXXXXXX",
  "project_slug": "01HSC4Z0PROJECTULIDXXXXXX",
  "event_seq":    3,
  "event_type":   "completed",
  "occurred_at":  "2026-05-23T04:17:00Z",
  "payload": {
    "result":        "succeeded",
    "body_markdown": "Tightened the auth middleware tests; added 4 new cases.",
    "links":         [{ "kind": "pr", "url": "https://...", "label": "PR #42" }],
    "duration_ms":   1240000
  }
}
```

Idempotency on `(run_id, event_seq)`. Duplicates return `409 { error.code: "duplicate" }`. Full contract in PRD §7.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `COMPASS_SESSION_SECRET must be at least 16 chars` at boot | set the env var (see Quickstart) |
| First sign-in redirects to `?error=invalid` and no user is created | set `COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=1` (one-time, then remove) |
| `Telegram failed: 400: ...` in `notifications` table | bot token wrong, or message body contains MarkdownV2-special chars that need escaping |
| CLI says "outbox: 3 pending" but never sends | server unreachable; check `compass status` and `COMPASS_BASE_URL` |
| Webhook returns 403 with "invalid signature" | hex string + HMAC over the **raw** body, not re-encoded JSON |
| FTS5 search returns nothing | run `pnpm db:migrate` to ensure the `search_index` virtual table was created |
| Litestream restore on boot fails | check `LITESTREAM_REPLICA_URL` + AWS credentials; first deploy has no replica yet (this is normal) |

## License

Personal project. Not redistributed.
