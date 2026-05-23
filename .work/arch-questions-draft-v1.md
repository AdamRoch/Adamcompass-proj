# Compass — Architecture Questions (Draft v1, pre red-team)

Context: PRD is for a single-user personal dashboard (Projects / Learning / Notes) with an explicit goal of being implementable over the course of a week. The PRD lists 6 open product questions; this list is specifically the *architecture* questions a staff engineer would want answered before producing a detailed, week-long implementation PRD.

Ordering principle: load-bearing decisions first — answers to early questions constrain or eliminate later questions.

---

## A. Foundation & Platform (load-bearing — answer these first)

- **A1. Platform target.** Web app only, web + desktop wrapper (Electron/Tauri), PWA, native? Drives everything below.
- **A2. Local-first vs server-based vs hybrid.** Does the database live on the user's machine, on a server, or both with sync? Determines whether we need sync, auth, hosting.
- **A3. Multi-device from MVP, or single device for week 1?** If multi-device, the sync section becomes load-bearing; if not, we defer an entire problem class.
- **A4. Auth model.** None (loopback only), single-user password, OAuth, device-token? Tied to A2/A3.
- **A5. Hosting & distribution model.** Self-hosted on personal box / Docker / cloud PaaS (Fly, Railway) / installable app / static site + serverless?

## B. Data & Persistence

- **B1. Database engine.** SQLite (file or libSQL/Turso), Postgres, embedded KV (LMDB)?
- **B2. Storage shape for rich content.** Notes & PRDs as markdown text, ProseMirror JSON, HTML, or block-based?
- **B3. ActivityEvent model.** Append-only event log as source of truth, or denormalized rows with derived feed? Impacts stall detection and momentum.
- **B4. Tag implementation.** Junction tables vs JSON array vs string with index? Affects search/filter speed and ergonomics.
- **B5. Schema migration strategy.** Drizzle/Prisma/Atlas migrations, hand-rolled, or none for week 1?
- **B6. Backup & export.** Mechanism (auto-snapshot, JSON dump, Git-backed file)? Required from start per PRD §8.
- **B7. Soft-delete vs hard-delete** for archived projects and orphaned notes?

## C. Sync (only relevant if A3 = multi-device)

- **C1. Sync strategy.** Last-write-wins, CRDT (Y.js, Automerge), or ElectricSQL/Replicache-style server-authoritative diff?
- **C2. Library / build-vs-buy.** Custom on top of HTTP, or off-the-shelf sync engine?
- **C3. Conflict edge cases.** Two devices reorder same kanban column, simultaneous note edits, simultaneous checklist toggles — what's the resolution policy?

## D. Frontend Stack

- **D1. Framework.** React, Svelte, SolidJS, Vue?
- **D2. Meta-framework / app shell.** Next.js, Remix, SvelteKit, vanilla Vite SPA, Tauri renderer?
- **D3. UI primitives & styling.** shadcn/Radix + Tailwind, Mantine, custom, design-system-from-scratch?
- **D4. State model.** URL as state + server cache (TanStack Query), client store (Jotai/Zustand), or local-first reactive (Y.js bindings, ElectricSQL hooks)?
- **D5. Rich text editor.** Tiptap/ProseMirror, Lexical, BlockNote, Plate, Milkdown, or plain Markdown textarea?
- **D6. Drag-and-drop.** dnd-kit, native HTML5 DnD, none-for-MVP?
- **D7. Keyboard navigation primitives.** cmdk, custom, kbar?

## E. Backend Stack (skip if A2 = pure local)

- **E1. Language & runtime.** Node/TS, Bun, Deno, Python, Go, Rust?
- **E2. API style.** REST, tRPC, GraphQL, RPC?
- **E3. Query layer.** Drizzle, Prisma, Kysely, raw SQL, ORM-of-language?
- **E4. Validation.** Zod, Valibot, native?

## F. Search

- **F1. Engine.** SQLite FTS5, Postgres tsvector, Meilisearch, Typesense, Lunr (client-side)?
- **F2. Semantic / vector search needed in any phase?** (Not in PRD but obvious extension.)
- **F3. Index update strategy.** Triggers, app-layer, periodic rebuild?

## G. Agentic Workflow Integration (single largest unknown in PRD)

- **G1. What is the actual agentic workflow?** Claude Code? OpenAI Codex? Custom shell pipeline? Sketch the runtime so Compass knows what it's integrating with.
- **G2. Inbound webhook contract.** Endpoint shape, auth (HMAC, bearer), idempotency keys, retry policy?
- **G3. Outbound trigger mechanism.** HTTP POST to a known endpoint, queue (SQS/Redis), file drop, CLI invocation?
- **G4. Outcome summary shape.** Free text? Structured (files changed, tests passed, PR URL)? What renders on the dashboard?
- **G5. Run state machine.** queued → running → completed/failed — who owns transitions?
- **G6. Identity mapping.** How does an external run know which Compass project it belongs to (slug, UUID, repo URL)?
- **G7. Manual fallback UX.** For MVP per PRD §5.2.4, manual log entry must exist — what fields?

## H. Reads, Reactivity, Computation

- **H1. Render model.** SSR + hydration, full SPA, or partial pre-render?
- **H2. Freshness model.** How fresh does the dashboard need to be (e.g., do overnight runs update live or only on next load)?
- **H3. Optimistic UI for writes** (checklist toggle, stage change)?
- **H4. Momentum & stall computation.** Computed on read every load, materialized into a `metrics` table, or background job?
- **H5. Timezone & "last 7 days" semantics.** UTC, user-local, configurable?

## I. Capture UX (the PRD calls capture out as critical — §7)

- **I1. Global hotkey.** Required from day one? Implies Tauri/Electron or system-level helper.
- **I2. CLI capture** from terminal (for the technical user)?
- **I3. Bookmarklet / share target / extension** for grabbing articles into reading list?
- **I4. Mobile capture path.** PWA on phone, native, or "skip — phone capture happens via email/Shortcuts"?

## J. Notifications & Reminders (PRD open question §4)

- **J1. Passive only** (counts and "this week" panel), or active?
- **J2. If active: channel.** Web Push, OS native (requires Tauri/Electron), email, iOS shortcut?

## K. Build, DevOps, Distribution

- **K1. Repo shape.** Monorepo (frontend + backend + shared types) vs single package?
- **K2. Starter / boilerplate.** Use create-next-app, T3, Tauri starter, or bespoke?
- **K3. CI / pre-commit.** GitHub Actions, lint-staged, none-for-week-1?
- **K4. Local dev experience.** One-command `pnpm dev`, docker-compose, devcontainer?
- **K5. Deploy target & cadence.** Where does v1 actually run, and how do updates ship?

## L. Scope Tradeoffs for a One-Week Build

- **L1. What of PRD Phases 1–3 is in week 1?** Phase 1 alone is already big — does week 1 ship all of Phase 1, or a thinner slice?
- **L2. "Boring tech" budget.** Where do we spend our novelty budget (probably the editor + agentic integration), and where do we stay boring (DB, framework)?
- **L3. Quality bar for week 1.** Throwaway personal prototype, "good enough for me to use daily," or "would be embarrassing to show to peers"?
- **L4. Definition of "done" for the week.** Deployed and in daily use, or merely feature-complete on localhost?

---

## What this list deliberately omits (and why)

- Pricing, monetization, multi-tenancy → single-user tool, not applicable.
- Permissions, sharing, RBAC → non-goal per PRD §2.2.
- Internationalization → single user.
- Accessibility → assumed baseline (semantic HTML + keyboard nav) but not a blocking architecture decision.
- Analytics → defer; personal tool.
