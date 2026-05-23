# Compass — Implementation PRD

**Working title:** Compass
**Document version:** 1.0 (week-1 implementation)
**Date:** 2026-05-23
**Author:** (you, with Claude)
**Status:** Implementation-ready
**Source documents:** [`Compass-PRD.md`](../Compass-PRD.md) (product PRD) and [`tender-leaping-kay.md`](/Users/adam/.claude-gauntlet/plans/tender-leaping-kay.md) (architecture walkthrough — source of truth for *why* each decision was made; this PRD says *what* to build)

---

## 0. How to use this document

This PRD describes what to build in week 1. It does not re-litigate decisions — for the reasoning behind any choice, see the architecture walkthrough plan. Section 16 contains a day-by-day fallback ordering; if you're behind, cut from the bottom.

Three companion decision docs live in `docs/decisions/` (framework, editor+storage, offline capture). The full UI design spec lives in `design/01-ui-themes-spec.md`. None of those are required reading to build; they're for retrospective learning and design reference.

---

## 1. Goal, non-goals, and the "v1 done" definition

### 1.1 Goal

Ship a single-user personal dashboard for projects / learning / notes that the user actually opens daily and trusts to surface what's in flight and what's stalled. Capture must be instant from four surfaces (web, CLI, mobile, global hotkey). Architecture is production-extensible — design for months of extension, not a throwaway.

### 1.2 Non-goals for v1

- Lifecycle pipeline UI (stage transition UI, board/kanban view, idea→project promotion UI)
- In-app PRD editor (URL link + optional Markdown body only)
- Reading-list dedicated UI (nested under Learning, no separate top-level)
- Active reminders beyond Telegram (no email, no web push, no native OS notifications)
- Multi-tenancy, sharing, RBAC (single user, forever)
- Habit tracking
- Sync between devices (server is canonical; clients are thin)
- Mobile-native apps (PWA only)
- Agentic build runs running for real (the webhook *contract* exists and the stub *receives* events; no agent actually calls it yet)

### 1.3 v1-done: three demoable flows

All three must work end-to-end by week-1 close:

1. **Web capture → file → dashboard:** quick-capture from the web app's always-visible input → entity lands in Inbox → user files it into a Project → Dashboard reflects the project's momentum + stall clock.
2. **CLI capture → daily Telegram digest:** `compass capture "ship the auth changes"` from any terminal → entity lands in Inbox → that evening's daily digest fires via Telegram and includes the capture.
3. **Webhook POST → activity event → dashboard:** `curl` posts a sample run-event payload to `/webhooks/v1/runs/events` → an `activity_event` row is written → the dashboard's project view shows the run on its activity log.

---

## 2. System architecture

```
                     ┌─────────────────────────────────────┐
                     │  Compass server (Fly.io or Render)  │
                     │  Next.js App Router + node-cron     │
                     │  Drizzle ORM, dual-DB                │
                     │  ┌─────────────┐  ┌──────────────┐  │
                     │  │  SQLite +   │  │  Postgres    │  │
                     │  │  Litestream │  │  (Neon/Fly)  │  │
                     │  │  (default)  │  │  (swap-able) │  │
                     │  └─────────────┘  └──────────────┘  │
                     └────────────┬────────────────────────┘
                                  │ public HTTPS
                                  │ cookie (browser) | bearer (others)
                ┌─────────────────┼──────────────────────────┐
                │                 │                          │
        ┌───────▼──────┐  ┌───────▼───────┐  ┌───────────────▼──────┐
        │  Web app     │  │  CLI binary   │  │  Menubar helper       │
        │  (browser +  │  │  (Node bin    │  │  (Tauri/Rust;         │
        │   PWA on     │  │   on $PATH;   │  │   global hotkey;      │
        │   mobile)    │  │   queue: flat │  │   queue: SQLite       │
        │  queue: SW   │  │   file)       │  │   on disk)            │
        │   IndexedDB  │  │               │  │                       │
        └──────────────┘  └───────────────┘  └───────────────────────┘
                                  │
                                  ▼
                          (future) agentic
                          coding workflow →
                          /webhooks/v1/runs/events
```

Single user. No multi-tenancy. Three thin clients hit one server. Mobile PWA is the web app installed on phone. All capture clients have a local outbox that replays on reconnect. The server is authoritative for all reads.

---

## 3. Repository structure

```
compass/
├── apps/
│   ├── web/                          Next.js App Router app
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (app)/dashboard/
│   │   │   ├── (app)/inbox/
│   │   │   ├── (app)/projects/
│   │   │   ├── (app)/learning/
│   │   │   ├── (app)/settings/
│   │   │   ├── api/v1/...           bearer-token REST
│   │   │   ├── webhooks/v1/...      HMAC + bearer
│   │   │   └── auth/device/...      device-code flow
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   ├── cli/                          Node binary (`compass`)
│   │   ├── src/
│   │   │   ├── commands/capture.ts
│   │   │   ├── commands/login.ts
│   │   │   ├── commands/list.ts
│   │   │   ├── outbox.ts            flat-file outbox + replay
│   │   │   └── index.ts
│   │   └── bin/compass.mjs
│   └── helper/                       Tauri menubar app (macOS first)
│       ├── src-tauri/                Rust shell, global hotkey, tray
│       └── src/                      Svelte or React renderer for settings UI
├── packages/
│   ├── db/                           Drizzle schema + queries + migrations
│   │   ├── schema/
│   │   │   ├── sqlite.ts             per-dialect schema
│   │   │   └── pg.ts                 per-dialect schema
│   │   ├── queries/                  shared business logic
│   │   ├── migrations/
│   │   │   ├── sqlite/
│   │   │   └── pg/
│   │   └── index.ts                  exports the active dialect client
│   ├── api-client/                   typed SDK shared by cli/helper/web
│   │   └── src/index.ts              fetch wrappers, types
│   ├── search/                       SearchProvider interface
│   │   ├── interface.ts
│   │   ├── fts5.ts                   SQLite FTS5 impl
│   │   └── tsvector.ts               Postgres tsvector impl
│   ├── notifications/                NotificationProvider interface
│   │   ├── interface.ts
│   │   └── telegram.ts               Telegram direct via Bot API
│   ├── scheduler/                    node-cron wrapper + job registry
│   └── shared/                       cross-cutting types, ulid, time, zod schemas
├── docs/                             this directory
├── design/                           UI design spec + theme prototypes
├── infra/
│   ├── fly.toml
│   ├── render.yaml
│   ├── litestream.yml
│   └── docker/
├── .github/workflows/                CI (test, lint, typecheck, both DBs)
├── package.json                      pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── README.md
```

**Tooling:** pnpm workspaces, Turborepo for pipelines, Vitest, Playwright, Biome (lint + format), tsc for typecheck. Node 22 LTS.

---

## 4. Data model & schema

### 4.1 Conventions

- **IDs:** ULID (26-char string), generated client-side or server-side via `monotonicFactory()`. Column type `TEXT` (SQLite) / `CHAR(26)` (Postgres).
- **Timestamps:** ISO-8601 strings stored as `TEXT` (SQLite) / `TIMESTAMPTZ` (Postgres). All inserts set `created_at`; mutations touch `last_touched_at` (see §10.1).
- **JSON payloads:** stored as `TEXT` containing JSON; parsed in app layer. Avoid `jsonb`/`JSON1` engine-specific types for portability.
- **Archive ≠ delete.** Status column carries `archived`; hard delete is an explicit admin action and cascades to all children.

### 4.2 Entity catalog

The full Drizzle schemas live in `packages/db/schema/{sqlite,pg}.ts`. Below is the logical model; both dialects implement the same fields with engine-appropriate types.

#### `project`
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `title` | TEXT | required |
| `summary` | TEXT | one-line |
| `body_markdown` | TEXT | optional inline PRD body |
| `prd_url` | TEXT | optional external PRD link |
| `stage` | TEXT enum | `idea`, `prd`, `building`, `review`, `shipped`, `archived` |
| `status` | TEXT enum | `active`, `parked`, `done` (derived convenience; canonical is stage) |
| `progress_pct` | INTEGER | 0–100; nullable (auto-derived if milestones exist) |
| `target_date` | TEXT (ISO date) | nullable |
| `repo_url`, `deploy_url`, `design_url` | TEXT | nullable |
| `snoozed_until` | TEXT (ISO ts) | nullable; clock resumes after this |
| `snooze_reason` | TEXT | nullable; surfaces on dashboard |
| `stall_threshold_days` | INTEGER | nullable override; default from settings (3) |
| `created_at`, `last_touched_at` | TEXT (ISO ts) | |

#### `learning_goal`
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `title` | TEXT | required |
| `motivation` | TEXT | "why this matters" |
| `body_markdown` | TEXT | optional notes body |
| `status` | TEXT enum | `curious`, `in_progress`, `completed`, `parked`, `archived` |
| `target_date` | TEXT (ISO date) | nullable |
| `snoozed_until`, `snooze_reason`, `stall_threshold_days` | as above (default 2) |
| `created_at`, `last_touched_at` | | |

#### `note` (the demoted Notes module — content attached to an entity OR unfiled in Inbox)
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `title` | TEXT | optional |
| `body_markdown` | TEXT | required |
| `entity_type` | TEXT enum | `project`, `learning_goal`, or NULL (unfiled → Inbox) |
| `entity_id` | ULID | FK on respective table (nullable when unfiled) |
| `inbox_type_hint` | TEXT enum | `idea`, `note`, `curiosity`, `unspecified` — only meaningful when unfiled |
| `created_at`, `last_touched_at` | | |

#### `milestone`
| field | type | notes |
|---|---|---|
| `id`, `project_id` (FK), `title`, `done` (boolean), `order_index`, `created_at`, `last_touched_at` | | UI deferred to week 2; schema present |

#### `checklist_item` (for learning goals)
| field | type | notes |
|---|---|---|
| `id`, `learning_goal_id` (FK), `title`, `done`, `order_index`, `created_at`, `last_touched_at` | | |

#### `resource` (reading list — articles, books, papers, videos, courses)
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `title` | TEXT | required |
| `author_source` | TEXT | nullable |
| `url` | TEXT | nullable |
| `kind` | TEXT enum | `article`, `book`, `paper`, `video`, `course`, `other` |
| `reading_status` | TEXT enum | `to_read`, `reading`, `read`, `abandoned` |
| `rating` | INTEGER | nullable, 1–5 |
| `learning_goal_id` | ULID | nullable FK |
| `note_id` | ULID | nullable FK to a takeaways note |
| `created_at`, `last_touched_at` | | |

#### `build_run`
| field | type | notes |
|---|---|---|
| `id` | ULID | PK (the `run_id` the agent supplies; we adopt it) |
| `project_id` | ULID | FK |
| `objective` | TEXT | the prompt/objective for the run |
| `status` | TEXT enum | `queued`, `running`, `completed`, `failed` (derived from latest event) |
| `body_markdown` | TEXT | outcome summary (latest) |
| `links_json` | TEXT | JSON: `[{kind, url, label}]` |
| `started_at`, `ended_at`, `duration_ms` | | nullable |
| `created_at`, `last_touched_at` | | |

#### `activity_event` (polymorphic; the canonical event log)
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `entity_type` | TEXT enum | `project`, `learning_goal`, `note`, `milestone`, `checklist_item`, `resource`, `build_run` |
| `entity_id` | ULID | FK to whichever table |
| `event_type` | TEXT | e.g. `created`, `stage_changed`, `milestone_completed`, `run_event`, `note_added`, `snoozed`, `unsnoozed`, `archived` |
| `payload_json` | TEXT | event-specific structured payload |
| `occurred_at` | TEXT (ISO ts) | canonical timestamp (agent-supplied for run events) |
| `received_at` | TEXT (ISO ts) | server receive time; for skew detection |

Indices: `(entity_type, entity_id, occurred_at DESC)`, `(event_type, occurred_at DESC)`.

#### `tag` & `tagging`
| field | type | notes |
|---|---|---|
| `tag.id` | ULID | PK |
| `tag.name` | TEXT | unique; lowercase; allows `/` (e.g., `area/ai`) |
| `tagging.tag_id`, `tagging.entity_type`, `tagging.entity_id` | composite PK | |

#### `settings` (single-row config table)
| key | value (JSON-typed) |
|---|---|
| `timezone` | string (default `America/Chicago`) |
| `default_stall_threshold_project_days` | number (default 3) |
| `default_stall_threshold_learning_days` | number (default 2) |
| `quiet_hours_start` / `quiet_hours_end` | strings (`22:00` / `07:00`) |
| `digest_send_time` | string (`09:00`) |
| `notif_telegram_enabled` | boolean |
| `notif_digest_enabled`, `notif_stall_enabled`, `notif_build_run_enabled` | booleans |
| `active_theme` | enum (`outer_space`, `white_sand`, `dark_forest`, `white_minimal`, `dark_minimal`) — default `white_minimal` |

Implementation: single `settings` row (id=`SINGLETON`) with `data_json` column. App layer typed-accesses via Zod.

#### `notifications` (delivery audit)
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `kind` | TEXT enum | `daily_digest`, `stall_alert`, `build_run_event` |
| `entity_type`, `entity_id` | nullable | what it's about |
| `channel` | TEXT enum | `telegram` |
| `payload_json` | TEXT | actual message body sent |
| `status` | TEXT enum | `pending`, `sent`, `failed`, `suppressed` |
| `error_message` | TEXT | nullable |
| `created_at`, `sent_at` | | |

#### `stall_alerts` (dedupe state)
| field | type | notes |
|---|---|---|
| `entity_type`, `entity_id` | composite PK | |
| `last_alerted_at` | TEXT (ISO ts) | |
| `alert_count` | INTEGER | |
| `suppressed_until` | TEXT (ISO ts) | for the 7-day "still stalled" reminder cap |

#### `webhook_deliveries`
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `endpoint` | TEXT | which webhook URL |
| `received_at` | TEXT (ISO ts) | |
| `headers_json`, `body_text` | TEXT | raw |
| `status` | TEXT enum | `accepted`, `rejected_auth`, `rejected_signature`, `duplicate`, `internal_error` |
| `dedup_key` | TEXT | e.g. `run_id:event_seq` |
| `error_message` | TEXT | nullable |

#### `audit_log`
| field | type | notes |
|---|---|---|
| `id`, `actor` (TEXT — `user`, `cli`, `helper`, `webhook`, `scheduler`), `action`, `entity_type`, `entity_id`, `metadata_json`, `at` | | append-only |

#### `auth_token`
| field | type | notes |
|---|---|---|
| `id` | ULID | PK |
| `name` | TEXT | label (`cli on adam-laptop`, `menubar helper`, `agent webhook`) |
| `token_hash` | TEXT | sha256(plain || pepper) of the actual token. Bcrypt was specified originally; sha256 with a server pepper is acceptable here because the underlying token is 24 random bytes (~192 bits) — collision/brute-force resistance is dominated by token entropy, not the KDF cost. `COMPASS_TOKEN_PEPPER` (env) must be a high-entropy server secret and rotating it invalidates all existing tokens. |
| `scope` | TEXT enum | `cli`, `helper`, `webhook` |
| `created_at`, `last_used_at`, `revoked_at` | | |

#### `user` (single row — but a table for clean schema)
| field | type | notes |
|---|---|---|
| `id`, `email`, `password_hash`, `created_at`, `last_login_at` | | |

### 4.3 Cascade rules

- Hard-deleting a `project` cascades to `note` (with `entity_id=project.id`), `milestone`, `build_run`, `activity_event` (filtered by `entity_id`), and any `tagging` rows.
- Hard-deleting a `learning_goal` cascades to its `checklist_item`, `note`, `resource` (resource's `learning_goal_id` set to NULL — resources can be standalone), `activity_event`, `tagging`.
- `archive` does NOT cascade — it's just a status change on the parent.

### 4.4 Migrations

Drizzle-kit migrations, per-dialect files under `packages/db/migrations/{sqlite,pg}/`. Single "intent" maintained in `packages/db/schema/` per dialect — write changes to both schema files and generate both migration sets. CI runs the full migration history against both engines on every PR.

---

## 5. Search layer

### 5.1 Interface

```ts
// packages/search/interface.ts
export interface SearchProvider {
  indexEntity(args: { entityType: EntityType; entityId: string; title: string; body: string; tags: string[] }): Promise<void>;
  removeEntity(args: { entityType: EntityType; entityId: string }): Promise<void>;
  query(args: { q: string; types?: EntityType[]; tags?: string[]; limit?: number }): Promise<SearchHit[]>;
}
```

### 5.2 SQLite impl (`fts5.ts`)

- One FTS5 virtual table: `search_index(entity_type UNINDEXED, entity_id UNINDEXED, title, body, tags)`.
- `INSERT OR REPLACE` on every entity write via the app layer (no triggers — keeps logic in TS, easier to debug).
- Query: `SELECT entity_type, entity_id, snippet(search_index, 2, '<mark>', '</mark>', '…', 16) FROM search_index WHERE search_index MATCH ? ORDER BY bm25(search_index) LIMIT ?`.

### 5.3 Postgres impl (`tsvector.ts`)

- Single `search_index` table: `(entity_type, entity_id, title text, body text, tags text, tsv tsvector GENERATED ALWAYS AS (...) STORED)` with GIN index on `tsv`.
- Same `INSERT OR REPLACE` app-layer pattern (Postgres `ON CONFLICT DO UPDATE`).
- Query: `SELECT entity_type, entity_id, ts_headline(...) FROM search_index WHERE tsv @@ plainto_tsquery($1) ORDER BY ts_rank(tsv, plainto_tsquery($1)) DESC LIMIT $2`.

### 5.4 Corpus (v1)

- Indexed: `project.title + summary + body_markdown + prd_url`; `learning_goal.title + motivation + body_markdown`; `note.title + body_markdown`; `resource.title + author_source + url`.
- Plus: tag names as a `tags` column (space-separated) for facet match.
- Not indexed (v1): `activity_event.payload_json`, `build_run.body_markdown` (deferred to v2 corpus).

### 5.5 Write path

Every mutation goes through a `touchEntity(tx, type, id)` helper that (a) updates `last_touched_at` (see §10.1), (b) re-indexes the entity in the search provider. Single source of truth, no triggers.

---

## 6. API surface

### 6.1 Conventions

- All `/api/v1/*` and `/webhooks/v1/*` are JSON-in, JSON-out, snake_case fields.
- Server actions (`'use server'`) are used internally by web app pages for mutations — no public REST equivalent unless a CLI/helper needs it.
- Auth:
  - Browser routes (`/`, `/dashboard`, `/login`, etc.): cookie session, NextAuth or hand-rolled.
  - `/api/v1/*`: `Authorization: Bearer <token>` from `auth_token` table (scope `cli` or `helper`).
  - `/webhooks/v1/*`: bearer + `X-Compass-Signature` HMAC-SHA256 over raw body using a secret stored in `auth_token` (scope `webhook`).
- Versioned via URL (`v1`). Breaking changes go to `v2`.

### 6.2 Endpoint catalog

**Auth (device-code flow for CLI/helper):**
- `POST /api/v1/auth/device` → `{ device_code, user_code, verification_url, expires_in }`
- `POST /api/v1/auth/poll { device_code }` → `{ status: 'pending' | 'approved' | 'denied', token? }`
- Browser route `/auth/device?code=XXXX` lets the user approve.

**Capture & inbox:**
- `POST /api/v1/captures` `{ idem_key (UUID), client_id, body, type_hint?, tags?, captured_at }` → `{ note: Note }`
- `GET /api/v1/inbox` → `{ notes: Note[] }`
- `POST /api/v1/inbox/:note_id/file` `{ target_type: 'project' | 'learning_goal' | 'note', target_id?, new_entity? }` → `{ note: Note }`

**Projects:**
- `GET /api/v1/projects` (filters: stage, status, tag, snoozed, stalled) → `{ projects: ProjectListItem[] }`
- `GET /api/v1/projects/:id` → full `{ project, milestones, notes, build_runs, activity_events (last 50) }`
- `POST /api/v1/projects` `{ title, summary, ... }` → `{ project }`
- `PATCH /api/v1/projects/:id { ...partial }` → `{ project }`
- `POST /api/v1/projects/:id/snooze { until, reason }` → `{ project }`
- `POST /api/v1/projects/:id/unsnooze` → `{ project }`
- `POST /api/v1/projects/:id/archive` → `{ project }`

**Learning goals & resources:**
- Mirror of project endpoints under `/api/v1/learning-goals`.
- `GET/POST/PATCH /api/v1/resources` for the reading list.

**Tags:**
- `GET /api/v1/tags` → `{ tags: Tag[] }` (with counts)
- `POST /api/v1/tags { name }`
- `PATCH /api/v1/tags/:id { name }` (rename — cascades via junction)

**Dashboard reads (cached, computed on read for v1):**
- `GET /api/v1/dashboard/momentum?days=7` → entities touched in window with delta
- `GET /api/v1/dashboard/needs-attention` → stalled entities (computed from thresholds)
- `GET /api/v1/dashboard/this-week` → entities with `target_date` in window
- `GET /api/v1/dashboard/counts` → counts by status across all modules
- `GET /api/v1/dashboard/digest/daily` → full Markdown body of today's digest (also called by Telegram trigger and exposed for future OpenClaw cron pull)

**Search:**
- `GET /api/v1/search?q=...&types=...&tags=...&limit=20` → `{ hits: SearchHit[] }`

**Export:**
- `GET /api/v1/export` → `200 application/json` full data dump (every table)
- (v2) `/api/v1/export/markdown` → tarball of per-note `.md` files

**Settings:**
- `GET /api/v1/settings` → `{ settings }`
- `PATCH /api/v1/settings { ...partial }` → `{ settings }`

**Admin/observability:**
- `GET /api/v1/admin/webhook-deliveries` (paged)
- `GET /api/v1/admin/notifications` (paged)
- `GET /api/v1/admin/audit-log` (paged)

### 6.3 Error contract

All error responses: `{ error: { code: string; message: string; details?: any } }` with appropriate HTTP status. Codes: `unauthenticated`, `forbidden`, `not_found`, `validation_failed`, `duplicate`, `internal`. Zod validation errors surface as `validation_failed` with `details.issues`.

---

## 7. Webhook contract (`POST /webhooks/v1/runs/events`)

### 7.1 Headers

- `Authorization: Bearer <webhook_token>` — required
- `X-Compass-Signature: sha256=<hex>` — HMAC-SHA256 of raw request body, secret stored alongside token
- `Content-Type: application/json`

### 7.2 Body

```json
{
  "run_id": "01HSC4Y3FAKERUNULIDXXXXXX",
  "project_slug": "01HSC4Z0PROJECTULIDXXXXXX",
  "event_seq": 3,
  "event_type": "completed",
  "occurred_at": "2026-05-23T04:17:00Z",
  "payload": {
    "result": "succeeded",
    "body_markdown": "Tightened the auth middleware tests; added 4 new cases. All green.",
    "links": [
      {"kind": "pr", "url": "https://github.com/adam/compass/pull/42", "label": "PR #42"},
      {"kind": "branch", "url": "https://github.com/adam/compass/tree/agent/auth-tests", "label": "agent/auth-tests"}
    ],
    "duration_ms": 1240000
  }
}
```

### 7.3 Semantics

- `event_type ∈ { queued, started, progress, completed, failed }`. `progress` events update `body_markdown`/`links` but do not change terminal status.
- `(run_id, event_seq)` is the idempotency key — unique constraint on `activity_event` (within `event_type='run_event'`).
- Out-of-order events: server reconciles. `build_run.status` is computed as the highest-seq event's result (with completed/failed terminating).
- Clock: `occurred_at` is canonical for ordering; `received_at` (server) stored for skew detection.
- Response: `200 { accepted: true, activity_event_id }` on success; `409 { error.code: 'duplicate' }` on idempotency hit; `401` / `403` on auth failures; `422` on validation.
- Every delivery — accepted or rejected — is logged to `webhook_deliveries`.

### 7.4 Replay

If the agent retries with the same `(run_id, event_seq)`, the second delivery returns 200 (or 409 if the first was already accepted) — never a duplicate write. The agent should treat 2xx and 409 both as success.

---

## 8. Capture flows (4 surfaces)

All four use the same idempotency contract:

```
POST /api/v1/captures
{
  "idem_key": "<UUID v7 generated by client>",
  "client_id": "cli-adam-laptop" | "helper-adam-laptop" | "web-<session>" | "pwa-<install>",
  "body": "the user's text",
  "type_hint": "idea" | "note" | "curiosity" | "unspecified",
  "tags": ["optional", "tags"],
  "captured_at": "<ISO ts on the client>"
}
```

Server dedupes on `(client_id, idem_key)`. Returns the created `note` (with `entity_type=null`, lands in Inbox).

### 8.1 Web app

- Always-visible single-line input at the top of every page in the app shell. Submit-on-Enter.
- Global `⌘N` opens a larger capture modal (Radix Dialog) with multi-line, type-hint dropdown, tag chip-input.
- Service worker (Workbox) intercepts the capture POST: if offline, queue in IndexedDB, return 202 to the UI with optimistic placeholder, replay when `navigator.onLine` flips.
- Toast on success (`Captured. Filed to Inbox.`). Toast on failure with retry.

### 8.2 CLI binary (`compass`)

- `compass capture "<text>"` — flag `--type=idea|note|curiosity`, `--tag x --tag y`, `--project <slug>` (skips Inbox).
- Outbox: append-only NDJSON file at `~/.compass/outbox.ndjson`. On every invocation, the CLI first tries to replay any queued lines, then sends the current capture. If a line fails (network), it stays in the outbox; line is removed on 2xx or 409.
- `compass capture` with no args reads stdin (pipe-friendly).
- `compass status` shows queue length and last server contact.
- `compass login` runs device-code flow; stores token in `~/.compass/credentials.json` (0600).
- Cross-platform: Node 22+ binary via `pkg` or `bun build --compile`; macOS + Linux first; Windows day-2.

### 8.3 Mobile PWA

- Same web app — install prompt on iOS/Android.
- Web Share Target registered in manifest: receives `text/plain` + URL share intents → opens to a pre-filled capture modal.
- Service Worker Background Sync API for the capture queue (where supported — fallback to IndexedDB queue + replay-on-app-open elsewhere; iOS Safari does not support Background Sync as of 2026, so iOS gets queue-on-failure + replay-on-app-open).
- Capture modal sized for thumb-reach; keyboard auto-focuses; submit clears + shows toast.

### 8.4 Menubar helper (Tauri)

- macOS first (week 1), Linux + Windows week 2+.
- Always-running tray app. Default global hotkey `⌥ Space` (configurable in helper settings).
- Hotkey opens a small popover capture window: single text field, Enter submits, Esc dismisses. Returns focus to the previous app.
- Outbox: SQLite at `~/Library/Application Support/compass-helper/outbox.sqlite`. Background thread retries every 10s when network appears.
- Settings UI: token paste, hotkey rebind, theme.

### 8.5 Type inference / picker

- Per the architecture decision, type is *picked*, not inferred. Capture defaults to `unspecified` (`type_hint`).
- Web modal has a small chip selector (Idea / Note / Curiosity / Unfiled).
- CLI uses `--type` flag.
- Helper popover has a single keystroke prefix convention: `! ` for idea, `? ` for curiosity, plain for note — parsed client-side before send.
- Inbox UI lets the user reclassify in one click.

---

## 9. Read paths & computed views

All v1 read views are computed on-demand at request time (no materialized views, no background job). SQLite + Postgres both handle the workload trivially at single-user scale.

### 9.1 Momentum strip

```sql
SELECT entity_type, id, title, last_touched_at, stage_or_status
FROM (
  SELECT 'project' AS entity_type, id, title, last_touched_at, stage AS stage_or_status
  FROM project WHERE last_touched_at >= :now_minus_7d
  UNION ALL
  SELECT 'learning_goal' AS entity_type, id, title, last_touched_at, status AS stage_or_status
  FROM learning_goal WHERE last_touched_at >= :now_minus_7d
)
ORDER BY last_touched_at DESC
LIMIT 20;
```

### 9.2 Needs-attention (stalled)

For each project/learning-goal: `last_touched_at < now - threshold_days` AND `(snoozed_until IS NULL OR snoozed_until < now)` AND `status NOT IN ('archived', 'done', 'shipped', 'completed')`.

Threshold = entity's `stall_threshold_days` (override) OR settings default (3 / 2). Apply user-local timezone for "days ago" math.

### 9.3 This-week

Entities with `target_date BETWEEN today AND today + 7d`, ordered by date.

### 9.4 Counts by status

`SELECT stage, COUNT(*) FROM project GROUP BY stage` and similar.

### 9.5 Inbox

`SELECT * FROM note WHERE entity_id IS NULL ORDER BY created_at DESC LIMIT 100;`

### 9.6 Activity feed (entity-scoped, on entity detail pages)

`SELECT * FROM activity_event WHERE entity_type=? AND entity_id=? ORDER BY occurred_at DESC LIMIT 50;`

---

## 10. Stall detection, snooze, alerts

### 10.1 `last_touched_at` rule

`last_touched_at` updates on **any write** to the entity (per the architecture decision). Implementation: a single `touchEntity(tx, type, id, now)` helper called inside every mutation transaction. There is no second "significant events only" path — simplicity over signal precision.

Child writes also touch the parent: writing a `milestone` for project X touches project X; adding a `note` filed to project X touches project X.

### 10.2 Stall computation

Run inline on every `GET /api/v1/dashboard/needs-attention`. Also run by the stall-alert cron job (§11.3) which compares current stalled set to `stall_alerts` table to decide what to fire.

### 10.3 Snooze

- `POST /api/v1/projects/:id/snooze { until: "ISO ts", reason: "text" }` writes `snoozed_until` + `snooze_reason` + an `activity_event` of type `snoozed`. While snoozed, item is *not* surfaced in needs-attention.
- Snooze does NOT modify `last_touched_at`. When snooze expires, the item's stall age resumes from where it was — if it crossed threshold during snooze, it re-enters needs-attention on the next read.
- UI: snoozed items appear elsewhere (a "Snoozed" filter on Projects/Learning lists) with badge + reason, not on dashboard needs-attention.
- Unsnooze action clears both fields.

### 10.4 Alert dedupe (`stall_alerts` table)

State machine, evaluated by the stall-alert cron:

```
For each currently-stalled entity:
  prev = stall_alerts row for (type, id)
  if prev IS NULL:
    fire alert, write stall_alerts row (last_alerted_at=now, alert_count=1, suppressed_until=now+7d)
  else if prev.suppressed_until > now:
    skip (still in 7-day cooldown)
  else if entity was touched after prev.last_alerted_at and re-crossed threshold:
    fire alert, increment alert_count, reset suppressed_until=now+7d
  else if now - prev.last_alerted_at >= 7d:
    fire weekly "still stalled" reminder, reset suppressed_until=now+7d
  else:
    skip
```

Unsnoozing without touching does NOT auto-re-fire — but the entity will be re-evaluated by the cron on its next pass. The 7-day cooldown still applies.

### 10.5 Active theme of "honest, not motivational"

The dashboard always shows snoozed items in their respective list views with badge + reason; they're not hidden, just not on the alarm-bell screen. The daily digest enumerates currently-stalled items (recap) regardless of dedupe.

---

## 11. Notifications (Telegram)

### 11.1 Provider abstraction

```ts
// packages/notifications/interface.ts
export interface NotificationProvider {
  send(args: { kind: NotificationKind; subject: string; body_markdown: string; ref?: { entity_type, entity_id } }): Promise<{ id: string; status: 'sent' | 'failed' | 'suppressed'; error?: string }>;
}
```

Single impl in v1: `TelegramDirectProvider` — POSTs to `https://api.telegram.org/bot<TOKEN>/sendMessage` with `chat_id`, `text`, `parse_mode: 'Markdown'`.

Reuses the existing OpenClaw Telegram bot: `TELEGRAM_BOT_TOKEN=8751030382:...` and `TELEGRAM_CHAT_ID=8756412374` set as Fly/Render env vars.

### 11.2 Scheduler

`node-cron` registered at server boot via `packages/scheduler`:

- **Daily digest** — `0 9 * * *` user-local timezone — composes Markdown digest, sends via Telegram, writes to `notifications`.
- **Stall sweeper** — every 15 minutes — re-evaluates stalled set, fires alerts respecting dedupe rules.

Quiet-hours check wraps every send: if current time is in quiet hours, defer to next allowed slot (queue in `notifications` as `pending`, sent by a "drain queue" job that runs at quiet-hours end).

### 11.3 Triggers

1. **`daily_digest`** — fires from cron. Composes (with `dashboard/digest/daily` query):
   ```
   *Compass — Friday May 23*

   *Momentum (last 7 days)*
   • Compass — touched today, stage: building
   • LangGraph internals — touched yesterday, in_progress

   *Needs attention*
   • [Project] Newsletter pipeline — 5d stalled
   • [Learning] Distributed systems book — 3d stalled

   *This week*
   • Compass target — May 29
   ```
2. **`stall_alert`** — fires per-entity from sweeper, respecting dedupe:
   ```
   *Stalled:* Newsletter pipeline (project)
   Last touched 5 days ago. /unsnooze, /snooze 3d, or open: https://compass.app/projects/...
   ```
3. **`build_run_event`** — fires from `/webhooks/v1/runs/events` handler immediately on `completed` or `failed` events:
   ```
   *Run completed:* auth-tests on Compass
   PR #42 → https://github.com/adam/compass/pull/42
   1240s
   ```

### 11.4 Settings panel

- Master toggle (Telegram on/off)
- Per-trigger toggles (digest / stall / build-run)
- Quiet hours (start / end, user-local)
- Digest send time
- Stall threshold defaults + per-entity overrides exposed in entity detail page

### 11.5 Future composability (out of scope week 1, documented)

`GET /api/v1/dashboard/digest/daily` returns the Markdown body. If the user later wants OpenClaw's cron to compose richer digests (e.g., synthesizing across multiple sources), an OpenClaw job can pull this endpoint and re-route through its existing delivery pattern. No Compass changes required.

---

## 12. UI architecture & routes

### 12.1 App shell

Next.js App Router with two layout groups:

- `(auth)` — `/login` only. Bare layout.
- `(app)` — everything else. Sidebar + main, sticky top capture input, ⌘K palette mounted globally.

### 12.2 Sidebar nav

| Item | Route | Notes |
|---|---|---|
| Dashboard | `/` | Default landing |
| Inbox | `/inbox` | Capture-first surface |
| Projects | `/projects` (+ `/projects/:id`) | List; detail; filters via URL params |
| Learning | `/learning` (+ `/learning/:id`, `/learning/reading`) | List, detail, nested reading view |
| Settings | `/settings` (+ subsections) | Themes, notifications, thresholds, tokens |

`⌘K` opens `cmdk` palette: top-level search + nav shortcuts + actions (Create project, Snooze, Theme: Outer Space, etc.).

### 12.3 Theming

CSS-variable token system (defined in `design/01-ui-themes-spec.md`). Active theme set on `<html data-theme="...">`; CSS variables cascade.

Theme switcher in Settings shows live preview (cycles all 5). Default theme on first run: `white_minimal`.

### 12.4 Component inventory (built on Radix primitives; no shadcn)

The design spec enumerates them. Engineering target: every component has light/dark glass treatment, focus ring, disabled state, loading skeleton equivalent (where applicable). Componentry sits under `apps/web/components/ui/` (atoms) and `apps/web/components/*` (composed widgets).

### 12.5 Density and keyboard

- Lists default to compact rows (32–40px). Toggle for comfortable density in settings.
- Every list-item has hover + selected + snoozed visual states.
- All primary actions have keyboard shortcuts surfaced via `⌘K` and tooltips.
- Vim-style `j/k` navigation on lists (week-1 stretch goal).

### 12.6 Render strategy

- Dashboard, Inbox, lists: server-rendered (RSC) with client islands for interactive bits (filters, snooze popover, capture input).
- Detail pages: server-rendered.
- Capture modal, ⌘K palette, settings interactions: client components.
- Optimistic UI on capture submit, snooze toggle, stage change.

---

## 13. Operations

### 13.1 Deployment

- Default: Fly.io (`fly.toml` in `infra/`). Single shared-cpu-1x machine, 512MB RAM (single-user workload). Region: `ord` (matches `America/Chicago`).
- Alt: Render (`render.yaml`). Same shape.
- Custom domain (e.g. `compass.adam.dev`) via the host's DNS automation.

### 13.2 Database lifecycle

**SQLite path (default):**
- DB at `/data/compass.db`, mounted Fly Volume (10 GB initially).
- Litestream replicates continuously to R2 bucket (config in `infra/litestream.yml`).
- Restore: `litestream restore -o /data/compass.db s3://...`.

**Postgres path (alternative, env-toggled with `COMPASS_DB_DIALECT=pg`):**
- Connection: `DATABASE_URL=postgres://...`.
- Recommended host: Neon (free tier or paid hobby).
- Backups: rely on host's managed snapshots (Neon point-in-time recovery; Fly Postgres `fly postgres backup create`).
- Migration parity verified in CI on every PR.

Swapping at runtime: set env var, restart server. No data migrates automatically — the user makes a deliberate choice and re-imports via `/api/v1/export` + a one-off import script (week-2+ deliverable; not required for v1 swap).

### 13.3 Migrations

`pnpm db:migrate` runs Drizzle-kit `migrate` against the active dialect. CI runs `drizzle-kit generate` + apply against both engines on every PR; mismatches fail the build.

### 13.4 Secrets

All sensitive values via env (Fly secrets / Render env vars / `.env.local` for dev):

```
COMPASS_DB_DIALECT=sqlite|pg
COMPASS_SQLITE_PATH=/data/compass.db
DATABASE_URL=postgres://...
COMPASS_SESSION_SECRET=...
COMPASS_WEBHOOK_HMAC_SECRET=...
TELEGRAM_BOT_TOKEN=8751030382:...
TELEGRAM_CHAT_ID=8756412374
LITESTREAM_REPLICA_URL=s3://bucket/path
LITESTREAM_ACCESS_KEY_ID=...
LITESTREAM_SECRET_ACCESS_KEY=...
```

No third-party tokens stored in the DB v1. Token table stores hashes of bearer tokens, not the tokens themselves.

### 13.5 Observability

- Structured logs via `pino` to stdout. Captured by Fly logs (`fly logs`).
- Tables (see §4.2): `webhook_deliveries`, `notifications`, `stall_alerts`, `audit_log`. Admin page (`/settings/admin`) renders the last N rows of each.
- No external (Sentry/Axiom) integration in v1 — single user, in-app surface is enough. Add `pino-pretty` for local dev.

### 13.6 Export

`GET /api/v1/export` streams a JSON document with every table's rows. Downloaded by browser as `compass-export-YYYYMMDD.json`. v2 adds per-note Markdown export as a tarball.

---

## 14. Security

- **TLS everywhere.** Public deployment uses host-managed TLS.
- **Auth tokens** stored as bcrypt hashes (`auth_token.token_hash`). Display the raw token exactly once at creation.
- **CLI login** uses device-code flow; CLI never sees a password.
- **Webhook auth** requires both bearer + HMAC. Body raw must be preserved (no JSON re-encoding) before signature verification.
- **CSRF:** all `POST/PATCH/DELETE` browser endpoints use Next.js server-action CSRF protection (built-in) or hand-rolled origin check on REST routes.
- **Password storage** uses bcrypt with cost 12.
- **Session cookie:** HttpOnly, Secure, SameSite=Lax, 30-day rolling.
- **Rate limiting:** simple in-memory token bucket on `/api/v1/captures` (60/min/client) and `/webhooks/v1/*` (300/min total). No DDOS protection beyond this — single-user, low traffic.
- **Captures from helper/CLI: queued data on disk** is not encrypted at rest in v1. Documented as a v2 hardening item.

---

## 15. Test strategy

### 15.1 Unit (Vitest)

- `packages/db/queries` — every query function with both dialects.
- `packages/search` — both providers against canned corpora.
- `packages/notifications/telegram` — mocked HTTP.
- `packages/scheduler` — cron expression evaluation.
- Pure-logic helpers: ULID, time math, stall computation, snooze evaluation, alert dedupe state machine.

### 15.2 Integration (Vitest + better-sqlite3 in-memory + pg-mem or testcontainers)

- API route handlers tested end-to-end: capture flow, file-from-inbox flow, snooze flow, stage change flow, webhook acceptance + dedupe.
- Run against BOTH dialects in CI matrix.

### 15.3 End-to-end (Playwright)

Three smoke tests — one per demoable flow:

1. `web-capture.spec.ts` — open web app, type into quick-capture, submit, verify it appears in `/inbox`, file into a created project, verify on `/dashboard`.
2. `cli-and-digest.spec.ts` — invoke CLI binary against a test server, capture, then trigger the daily-digest job manually, verify Telegram provider mock received expected payload.
3. `webhook.spec.ts` — POST a sample run event to `/webhooks/v1/runs/events` with valid HMAC, verify `activity_event` row + project detail page reflects run.

CI runs all three on every PR against SQLite. Postgres path runs unit + integration on every PR; E2E on main.

### 15.4 Manual verification per cut

Before tagging v1: walk through all three demoable flows on a fresh DB, on both dialects, capture screenshots.

---

## 16. Week-1 plan & fallback ordering

### 16.1 Day-by-day target

| Day | Track A (server + data) | Track B (web UI + themes) | Track C (clients + integrations) |
|---|---|---|---|
| 1 (Sat) | Repo scaffold, pnpm workspaces, Turbo, Biome, tsconfig. Drizzle schema for both dialects. Migrations runnable on both. | Next.js app shell + sidebar nav + capture input + theming infra (CSS vars). One theme (`white_minimal`) fully implemented. | — |
| 2 (Sun) | Auth (cookie session + bearer token table + device-code endpoints). Capture API + idempotency. Inbox API. | Inbox page (server-rendered). Capture submit working end-to-end. Login page. Settings page skeleton. | — |
| 3 (Mon) | Project + LearningGoal CRUD APIs. Snooze API. `activity_event` writes from mutations. `last_touched_at` helper. Search abstraction interface + FTS5 impl. | Projects list + detail. Learning list + detail. Stage pill + snooze popover. Search palette (⌘K) wired to API. | — |
| 4 (Tue) | Dashboard read endpoints (momentum, needs-attention, this-week, counts). Stall computation. | Dashboard page. Activity log on detail pages. Visual states: stalled badge, snoozed badge. | CLI `capture`, `login`, `status`. Outbox + replay. Distribute via `bun build --compile`. |
| 5 (Wed) | Webhook endpoint with HMAC + bearer + idempotency. `webhook_deliveries` + admin page. tsvector search impl. Postgres migration parity validated in CI. | 4 remaining themes implemented. Theme switcher with live preview. Density toggle. | Menubar helper (Tauri scaffold + tray + hotkey + capture popover + outbox + replay). |
| 6 (Thu) | Notifications scheduler + Telegram provider + 3 triggers + `stall_alerts` dedupe + `notifications` table + quiet hours. | Settings panels for notifications + thresholds + theme + tokens. Admin observability page. | Mobile PWA polish: install prompt, share target, offline indicator, service worker for capture queue. |
| 7 (Fri) | Integration tests across both dialects. Playwright smokes. Bug fix pass. | Polish pass: empty states, loading skeletons, focus states. | Helper installer + CLI install script. Deploy to Fly. Cut release tag. |

### 16.2 Fallback cut order (if behind)

If you reach Day 4 and Track B is slipping:
1. Cut **4 of 5 themes** → ship only `white_minimal` + spec for others.
2. Cut **menubar helper** → defer to week 2 (CLI + web + mobile PWA still cover 3 of 4 surfaces; only global hotkey slips).
3. Cut **mobile PWA service-worker offline queue** → leave PWA online-only week 1.
4. Cut **Postgres path** → SQLite + Litestream only; document the Postgres migration scope for week 2.
5. Cut **Telegram stall alerts** → keep daily digest only.
6. Cut **admin observability page** → tables still populated; view via direct DB query.

The three demoable flows (§1.3) are non-negotiable.

### 16.3 Definition of done

- All migrations apply cleanly on a fresh DB, both dialects.
- Three Playwright smoke tests green.
- A fresh user can: sign in, capture from web, file from inbox, see momentum + stalls on dashboard, receive a Telegram daily digest, POST a webhook and see the run on a project.
- Deployed to Fly.io behind a real DNS name. Litestream restoring cleanly to a scratch instance.

---

## 17. Open risks & assumptions

1. **Ambitious scope.** 14+ work items in 7 days. Honest estimate: 9–12 days. Fallback ordering exists; some Track C items will likely slip. The user has explicitly accepted this.
2. **Theme work is novel.** Liquid-glass + 5 themes built without shadcn is a real budget item — first theme is the hardest, others are token-swap. Designer side-deliverable de-risks but the engineer still has to implement.
3. **Tauri helper on macOS first.** Global hotkey APIs on Linux differ; Windows is week-2+. First Tauri build is a setup tax (~half day) for someone who hasn't shipped one before.
4. **iOS PWA limits.** Background Sync API not supported on iOS Safari — captures-while-offline replay on next app-open, not in the background. Documented in user-facing settings copy.
5. **Webhook unverified against real agent traffic** until an actual agent exists. Contract is designed conservatively; concrete drift only surfaces when integration goes live.
6. **3-day / 2-day stall thresholds are aggressive.** Combined with "any-write touched", may produce more Telegram traffic than tolerable. Dedupe + quiet hours + 7-day cooldown + snooze are all designed to mitigate. If still noisy in week-1 use, bump defaults — they're stored in `settings`.
7. **Notes-as-property model** (vs peer module) is a one-way door for the schema. If "Notes module" turns out to be wanted, retrofit cost is one new table + a migration.
8. **Single-user assumption is permanent.** Adding multi-user later requires touching every entity table (add `user_id`) and every query. Don't plan around it changing.
9. **OpenClaw Telegram bot token is shared with another system.** Compass and OpenClaw will both post to the same chat. If this is unwanted, mint a dedicated Compass bot — one env var change.
10. **`pg-mem` vs real Postgres in CI.** `pg-mem` is faster but lacks some FTS features. If tsvector queries don't round-trip cleanly, fall back to testcontainers in CI for that one impl (slows the suite by ~30s).

---

## 18. Out of scope for v1 (explicit non-goals)

Repeat for safety — none of these ship in week 1, even if completed early:

- Idea/Curiosity → Project/LearningGoal **promotion UI** (schema supports it; UI is week 2+)
- Kanban / board view
- In-app rich PRD editor (URL field + plain Markdown body only)
- Active reminders other than Telegram (no email, no web push, no OS notifications)
- OAuth login (the user signs in with password; can rotate via settings)
- Sharing, collaboration, multi-user
- Habit tracking
- Repo / GitHub integration that auto-imports commits or PRs
- Vector / semantic search
- AI-generated summaries
- Public-facing pages

---

## 19. Appendices

### 19.1 ULID generation

Use `monotonicFactory()` from `ulid` package on both server and clients. Server generates IDs unless a client supplies one (webhook `run_id`, capture client-side gen for offline-first).

### 19.2 Timezone

Single user-local timezone in `settings.timezone` (default `America/Chicago`, matching OpenClaw). All "today", "yesterday", "7 days ago" math goes through a `timeWindows.ts` helper that reads settings.

### 19.3 Tag namespacing convention

Tags are case-folded to lowercase, hyphenated. Names may contain `/` for a soft hierarchy (`area/ai`, `area/infra`) — the database treats them as opaque strings; the UI optionally renders the slash as a separator.

### 19.4 Environment matrix

| Var | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | |
| `COMPASS_DB_DIALECT` | yes | `sqlite` | `sqlite` or `pg` |
| `COMPASS_SQLITE_PATH` | when dialect=sqlite | `/data/compass.db` | |
| `DATABASE_URL` | when dialect=pg | — | |
| `COMPASS_SESSION_SECRET` | yes | — | 32+ chars random |
| `COMPASS_WEBHOOK_HMAC_SECRET` | yes | — | 32+ chars random |
| `TELEGRAM_BOT_TOKEN` | when notif enabled | — | reuses OpenClaw bot for v1 |
| `TELEGRAM_CHAT_ID` | when notif enabled | — | `8756412374` |
| `COMPASS_BASE_URL` | yes | — | e.g. `https://compass.adam.dev` |
| `COMPASS_TZ` | no | `America/Chicago` | override of settings default |
| `LITESTREAM_REPLICA_URL` | when dialect=sqlite (prod) | — | |
| `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | when replicating | — | |

### 19.5 References

- Architecture decisions: `/Users/adam/.claude-gauntlet/plans/tender-leaping-kay.md`
- Product PRD: `../Compass-PRD.md`
- Framework decision: `docs/decisions/01-framework-comparison.md`
- Editor + storage decision: `docs/decisions/02-editor-and-storage.md`
- Offline capture decision: `docs/decisions/03-offline-capture.md`
- UI design spec: `../design/01-ui-themes-spec.md`
