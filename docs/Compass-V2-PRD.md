# Compass V2 — Product Requirements Document

| | |
|---|---|
| **Document version** | 2.0 |
| **Date** | July 18, 2026 |
| **Status** | Active — drives the V2 build |
| **Predecessors** | [Product PRD v1](../Compass-PRD.md) · [Implementation PRD v1](Compass-Implementation-PRD.md) · [Build status v1](../BUILD_STATUS.md) |

---

## 1. Where v1 landed

v1 shipped the capture-and-triage spine end to end and it is verified working today
(typecheck 9/9 green, 90 vitest tests green as of 2026-07-18):

- **Capture from 4 surfaces** (web ⌘N, PWA share target, CLI, Tauri menubar) → unified Inbox → file into Project or Learning Goal.
- **Dashboard** with momentum, needs-attention (stall detection + snooze), this-week, counts.
- **Server stack**: ~30 REST endpoints, cookie + bearer auth with scopes and device-code flow, webhook receiver with HMAC + idempotency, FTS5/tsvector search, Telegram digest + stall alerts via node-cron scheduler, dual-dialect Drizzle (SQLite default, Postgres optional), Fly.io + Litestream infra.
- **5 runtime-switchable themes** with a liquid-glass token system and 24 Radix-based UI atoms.

### What v1 explicitly deferred (confirmed still absent)

| Gap | Evidence |
|---|---|
| Milestones: schema exists, **zero API + zero UI** | `milestone` table dead except export/activity rendering |
| Note body editing (Inbox is file/keep only), no `/api/v1/notes` | BUILD_STATUS follow-up |
| Tag rename API exists, **no UI surface** | BUILD_STATUS follow-up |
| Archive is only a PATCH side-effect; no explicit archive/restore actions with reason | Impl PRD §6.2 |
| Global activity feed — dashboard "Activity" card is a static ⌘N hint | `app/(app)/page.tsx:327` |
| Project board (kanban) view; idea→project promotion; in-app PRD editor | Product PRD Phase 2 |
| Curiosity log with promotion to learning goal | Product PRD Phase 2 |
| Build-run **queueing UI** + overnight run summary card | Product PRD §5.2.4 (webhook receiver is live; producer/UI side missing) |
| Webhook `project_slug` must be a ULID — human slugs unsupported | `packages/shared/src/zod.ts:123` `TODO(v2)` |
| Real icons (PWA ships 1×1 transparent PNGs; Tauri ships a placeholder) | `apps/web/public/README-icons.md` |
| Device-code overloads `token_id` column with the pending plain token | BUILD_STATUS security follow-up |
| `counts()` / `momentum()` materialize-then-sort in JS instead of SQL | BUILD_STATUS perf follow-up |
| Postgres app-level integration untested (unit only) | BUILD_STATUS |
| Helper `open_url` mac-only; no cargo check in CI | Explore audit |

## 2. V2 thesis

v1 proved the **capture** loop. V2 makes Compass the place where work is **advanced**, not just
recorded, and makes the surface worth living in all day:

1. **Close the loop on planning** — milestones, the idea → PRD → build pipeline as a board, in-app PRD authoring.
2. **Close the loop on learning** — curiosity log, promotion, resource/note flows that don't dead-end.
3. **Close the loop on agentic runs** — queue a run with an objective, see the overnight summary the next morning. (No external agent is required to test: the webhook receiver + a simulator script stand in for it.)
4. **A front end that earns daily use** — the design spec's glass/theme system pushed to "visually stunning": polished dashboard, board view, activity feed, real iconography, motion.
5. **Pay down the debt above** so v2 stands on a sound base.

**Non-goals (unchanged from v1):** multi-user/sharing, native mobile apps, executing builds inside
Compass, vector/AI search, general-purpose PKM. Anything needing external API keys (Telegram already
works; repo-host integrations) is built behind the existing provider seams and verified with fakes.

## 3. Functional requirements

### 3.1 Milestones (F1)
- CRUD API: `GET/POST /api/v1/projects/:id/milestones`, `PATCH/DELETE /api/v1/milestones/:id` (title, done, sort order, optional target date).
- Project detail: milestone checklist with add/toggle/reorder/delete inline.
- `progress_pct` auto-derives from milestone completion when milestones exist (manual override stays).
- Toggling writes `activity_event` (`milestone_completed`) and touches the project.

### 3.2 Notes as first-class records (F2)
- `GET/PATCH/DELETE /api/v1/notes/:id` — edit body/title/tags anywhere a note renders (inbox, project, goal, notes list).
- `/notes` page: all notes, filter unfiled/by-tag/by-entity, inline edit, file-from-here.
- Search index updated on edit; activity event on edit.

### 3.3 Explicit archive + tag management (F3)
- `POST /api/v1/{projects,learning-goals}/:id/archive` (+ `/restore`) with optional reason; archived items leave dashboards, keep search.
- Settings → Tags panel: list with usage counts, rename (API exists), merge, delete-if-unused.

### 3.4 Project board + pipeline (F4)
- `/projects` gains a **Board** tab: columns = stages, drag-to-move (writes stage change + activity event), keyboard fallback (stage select stays).
- **Idea intake**: capture with `type_hint=idea` files into a project at stage `idea` in one action from Inbox.
- **In-app PRD**: project detail gets a `prd_markdown` document (template: problem / goals / requirements / scope) with a markdown editor + preview. Promoting PRD→Building offers to seed milestones from the PRD's `## Requirements` bullets.

### 3.5 Curiosity log (F5)
- Captures with `type_hint=curiosity` get a dedicated Inbox lane + `/learning` "Curiosities" rail.
- One-action **promote to learning goal** (prefills title/motivation, links the originating note).

### 3.6 Agentic build runs, front side (F6)
- **Queue Run** on a project: creates `build_run` status `queued` with objective; visible on project + dashboard.
- **Overnight summary card** on Dashboard: terminal-state runs since last seen (result, duration, links), replacing the static Activity card.
- Run detail drawer: event timeline from `activity_event`.
- Webhook accepts human `project_slug` in addition to ULID (resolves via new unique `slug` column on project).
- `scripts/simulate-run.ts`: plays a queued→running→completed event sequence against the webhook (signed), used by tests and demos.

### 3.7 Global activity feed (F7)
- `/activity` page: reverse-chron, filter by entity type/event type, infinite scroll (cursor pagination).
- `GET /api/v1/activity?cursor=&types=`.

### 3.8 Visual excellence pass (F8)
- Real icon set: maskable PWA icons + favicon + Tauri icon (generated compass mark, not placeholders).
- Dashboard redesign: glass cards with real hierarchy, sparkline momentum, stall heat, motion on load/hover per design-spec §motion (respects `prefers-reduced-motion`).
- Board view drag physics, empty states with personality, skeletons everywhere data loads.
- Typography/spacing audit against `design/01-ui-themes-spec.md`; all 5 themes verified per page.

### 3.9 Debt & hardening (F9)
- Dedicated `pending_plain_token` column for device-code flow (drop the `token_id` overload).
- `counts()`/`momentum()` rewritten as `GROUP BY` / `UNION ALL … ORDER BY … LIMIT` SQL.
- Postgres added to the vitest integration matrix (skip-if-no-`DATABASE_URL` guard locally).
- Playwright browsers install step documented + e2e green in CI; helper `open_url` for Linux/Windows.

## 4. Data model changes

| Change | Detail |
|---|---|
| `project.slug` | nullable unique text, auto-derived from title on create (kebab, dedup suffix); webhook resolves slug **or** ULID |
| `project.prd_markdown` | nullable text |
| `auth_token.pending_plain_token` | nullable text; device-code flow stops overloading `token_id` |
| `milestone.sort` | integer default 0 (ordering) |
| No new tables | curiosity = existing note `type_hint`; feed = existing `activity_event` |

One migration per dialect (`0002_v2.sql`), additive only — no destructive changes.

## 5. Phasing

| Phase | Contents | Gate |
|---|---|---|
| **V2.0 — Foundations** | F9 debt items, F1 milestones, F2 notes, F3 archive+tags | typecheck + vitest + e2e green; code-review pass |
| **V2.1 — Pipeline** | F4 board+PRD, F5 curiosity, F6 runs, F7 feed | same + simulate-run demo works |
| **V2.2 — Surface** | F8 visual pass, icons, motion, theme audit | visual review across all 5 themes + e2e green |

Each phase ends with a code-review + test-audit gate before the next begins.

## 5.1 Consciously deferred (from the V2.0 review gate)

- Tag editing on individual notes (notes carry tags from capture; editing them post-hoc waits for demand).
- `milestone.target_date` (milestones have title/done/order; dates stay at the project level).
- Per-spec e2e DB reset (specs are existence-based by convention — documented in `tests/e2e/login.ts`).
- Slug-collision insert race on concurrent project creates (single-user; practically unreachable).

## 6. Success criteria

- Every table in the schema has a living UI surface (no dead schema).
- The three v1 demo flows still pass, plus two new demoable flows:
  4. Queue a run → `simulate-run.ts` fires webhook events → overnight summary shows the result.
  5. Idea captured → promoted on the board → PRD authored in-app → milestones seeded → progress advances.
- All 5 themes render every page without visual defects; PWA installs with real icons.
- Zero known type errors, zero skipped tests, e2e green.
