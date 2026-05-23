# Decision 03 — Offline capture behavior for the four capture surfaces

**Status:** Decided (Batch 4, E3)
**Decision:** Option 2 — All clients queue locally and replay when online.
**Scope:** Quick-capture flow only. Edits to existing entities follow a different policy (server-canonical, online-only) because no sync engine exists.

---

## Why this decision matters

PRD §7 states the non-negotiable: **"Capture must be instant. Adding an idea, note, or topic should take one input and one keypress. Friction here defeats the product."** §10's leading success metric is capture rate — if capture feels heavy, the user returns to scattered tools and the product is dead.

Architecture choices from Batches 1–3 sharpen the question:

- **F4** locked four capture surfaces (web, CLI, mobile PWA, menubar helper). CLI/helper get invoked on planes, hotel wifi, mid-deploy windows. They cannot assume connectivity.
- **F3** set the quality bar to "production-extensible" — no shortcut we'd rip out in month 2.
- **B1/B2** made the server canonical (no CRDT, no sync engine). So "queueing" is narrowly scoped to inserts — an outbox, not Yjs.
- **Stall thresholds** (3d/2d) and **notification dedupe** (Batch 6) mean a double-fired capture is observable: two ideas, two activity events, possibly two Telegram messages.

Pick wrong and you ship either lost captures (worst-class bug) or duplicates with visible downstream noise.

---

## The three options

1. **Synchronous capture, fail loudly if server unreachable.** Cheapest. Every client makes a blocking POST; on failure, the user sees an error and is responsible for retrying.
2. **All clients queue locally and replay when online.** Production-grade. Every client has a durable outbox. The capture UI returns optimistically; a background worker flushes the outbox to the server.
3. **Hybrid: CLI/helper queue locally, web/mobile fail loudly.** Pragmatic. Native clients (where the user has a real session and likely no other path) get a queue; browser clients fail fast because the user is in front of a browser and can see the error.

The rest of this document walks each one in detail and then explains why option 2 won.

---

## Option 1 — Synchronous capture, fail loudly if server unreachable

### Implementation cost per client

- **Web app:** trivial. A server action posts to the DB; on rejection, render a toast. No client storage. Maybe a half-day to wire correctly with optimistic UI rollback.
- **CLI:** trivial. `compass capture "..."` makes a single HTTPS POST; on non-2xx, prints an error and exits non-zero. No on-disk state. A few hours.
- **Mobile PWA:** trivial in code, but worst UX. `fetch()` from the browser; on failure, show an error in the standalone PWA shell. The user is most likely to hit this on a phone with flaky LTE.
- **Menubar helper:** trivial. Hotkey opens a modal, user types, hits enter, the helper POSTs, modal closes on 200, modal turns red on failure. A day at most.

**Total cost:** maybe 2 days across all four clients combined. This is the "ship it Monday morning" option.

### Idempotency design

Not strictly required, but you'd still want a client-generated UUID per capture attempt so retry-from-error doesn't create duplicates. Server enforces `UNIQUE(client_id, idem_key)` on the captures table. Cost: one column plus one index.

### Replay ordering

N/A — there's no replay. Captures arrive in real time or they're errored.

### Failure modes

- **Lost captures on transient network failure** (dominant). User types an idea on coffee-shop wifi mid-DHCP-renegotiation, hits enter, sees a red toast, swears, retypes — or doesn't, and the thought is gone.
- **Lost captures during deploy.** Fly/Render rolling deploys typically take 30–90s where the API is unreachable. Every capture in that window fails loudly.
- **Lost captures during server overload.** 503 → user error.
- **No double-fire risk** (if idem is wired). But also no retry — zero false-positives, many false-negatives.
- **Clock skew:** trivially aligned (server timestamp wins).
- **Intentional duplicates:** work correctly (fresh idem key each time).

### UX implications

- **Spinner-and-wait** for the 2xx before the modal closes. Fine on 100ms RTT; feels broken on 2000ms hotel wifi.
- **Visible error states on mobile PWA feel cheap** — user blames the app for the network.
- **Violates "Capture must be instant"** any time the network isn't ideal. This is why the option loses.

### Observability

- Easy server-side (server logs tell you what arrived); blind client-side (no record of attempted-but-failed captures anywhere).

### Security

- Nothing queued. No data at rest on the client beyond the in-flight POST. Lowest risk surface.

### Migration / phasing

- **Trivially upgradeable to option 2.** Option 1 is a strict subset: client posts directly; option 2 intercepts the post and writes to an outbox first. Server contract identical. No data loss because option 1 has no persistent client state. **But** once you ship option 1, the first lost capture is a trust violation that compounds — code migration is easy, trust recovery is not.

### Edge cases

- **Large captures (embedded data URL):** synchronous POST is fine; respect server body limit (1–5MB on Fly/Render); surface "too large" errors clearly.
- **Capture during server outage / deploy:** lost. Headline failure mode.
- **Capture from CLI when offline (airplane):** errors immediately. User on the hook to remember to re-capture. Not viable for a tool meant to run from a terminal anywhere.

### Verdict on option 1

Cheap, simple, *exactly the wrong tradeoff* for Compass. Would be fine for a product where capture failure is acceptable (Slack has retry; an admin dashboard tolerates a failed save). For Compass — capture as central UX commitment, four surfaces designed for flaky conditions — this loses on the exact axis the product is optimized for.

---

## Option 2 — All clients queue locally and replay when online (CHOSEN)

### Implementation cost per client

- **Web app:** ~1 day. IndexedDB via a tiny wrapper (idb-keyval is ~600 bytes gzipped). Queue is read on page load and on `online` event. Optimistic UI: capture modal closes immediately, an "outbox: N pending" indicator in the chrome, items appear in Inbox/Dashboard with a "syncing" badge until acked.
- **CLI:** ~1 day. Flat file beats SQLite here: zero dependencies, `tail ~/.compass/outbox.jsonl` to inspect, append-only. The CLI command exits successfully *as soon as the line is fsynced*; a separate `compass flush` (or short-lived child process) drains. **Atomicity matters.** `write()` to an `O_APPEND` fd is atomic up to `PIPE_BUF` (~4KB) — longer markdown bodies could be split. Use `flock()` around append, or write-to-tmp + rename. The "process killed mid-write" case (`kill -9` during append) is real; mitigate by making each line self-describing JSON and having the flusher quarantine malformed trailing lines to `.corrupt` for inspection.
- **Mobile PWA:** ~1.5 days. Two viable storage paths converge into one hybrid (see "PWA tradeoff" subsection below): IndexedDB outbox as the durable store, Service Worker Background Sync as an opportunistic accelerator where supported.
- **Menubar helper:** ~1.5 days. **SQLite on disk** at `~/Library/Application Support/Compass/queue.db`. Reasons: long-running process so transactional integrity matters; queue may accumulate hundreds of items over multi-day offline periods (long flight + a week off-grid); SQLite gives free durability (`PRAGMA synchronous=FULL`, WAL journal), free queryability for an "outbox" pane in the helper UI, trivial backup. Flat-file is the cheaper alternative but loses the inspector UI affordance.

**Total:** ~5 days client work across four surfaces. The plan's "~1 day total" was the *additional* cost on top of the baseline capture flow already being budgeted.

### Idempotency design

Load-bearing. Get it wrong and you trade lost captures for duplicated captures.

- **Client-generated ULID per capture** (matches D9 — sortable). Generated when the user hits enter, before the queue write.
- **Server-side `UNIQUE(client_id, idem_key)`.** `client_id` is per-installation (web session ID, CLI install UUID, helper install UUID, PWA's IDB-generated UUID).
- **On collision:** server returns 200 with the existing row's ID; client treats as successful replay and drops the outbox row.
- **Hash-based dedup is an attractive nuisance** — "same content within 5 seconds is a duplicate" breaks the legitimate "I typed 'follow up on rust crate' twice on purpose" case. Stick to explicit client IDs.
- **Replay safety:** the capture endpoint is purely an insert. Activity event creation must also key off the same idem key so replays don't double-emit events (which would noisily trip stall logic and Telegram).

### Replay ordering

For Compass: **we don't care.** Each capture is independent. The outbox is a multiset of independent inserts. We drain in arrival order out of politeness, but if two clients' captures land interleaved, nothing breaks.

This is a Compass-specific gift. For a doc editor with capture-then-edit sequences, this is the hard problem and you'd need per-document op logs or a CRDT. Worth naming so we don't smuggle in code that *assumes* order — e.g., don't make activity event sequence numbers per-client; let the server assign them on write.

### Failure modes

- **Lost captures on crash.** Mitigated by writing to durable storage *before* the UI closes: `fsync()` (CLI), `transaction.complete` (IDB), `PRAGMA synchronous=FULL` (SQLite). Cost is a few invisible milliseconds.
- **Double-fires on retry.** Prevented by idem key. Flusher retry can be aggressive (1s → 5min exponential, infinite while queued) because every retry is safe.
- **Clock skew between client and server.** Store both `captured_at` (client clock, when user hit enter) and `received_at` (server clock). User-facing semantics use `captured_at` ("the idea I had on the plane is dated when I had it"). `received_at` is for skew detection and debug only. Mirrors A6.
- **Same capture twice intentionally.** Each submit generates a fresh idem key — two real rows. Correct.
- **Outbox corruption.** CLI: malformed lines → `.corrupt` file. Helper SQLite: WAL + `PRAGMA integrity_check` on startup; salvage what's readable, quarantine the rest. IDB: read errors logged; user can inspect in DevTools.
- **Outbox grows unboundedly.** Defensive bound: warn at 1000 items per client, hard-stop at 10000 with a loud UI.
- **Auth token expires while queued.** Flusher catches 401, surfaces "re-login required" (helper UI / next `compass capture` message), pauses. Queue drains naturally on re-auth.
- **Server schema migration.** Capture payload is intentionally dumb (idem key, captured_at, content type hint, body). URL-versioning (`/api/v1/captures`) is the escape hatch.

### UX implications

- **Fire-and-forget for the user, durable for the system.** Capture modal closes the instant the local write is acknowledged (single-digit ms). This is what "instant" actually requires.
- **"Queued" indicator** — subtle badge in the app chrome ("outbox: 3 pending"); `compass status` for CLI; menubar icon pulses for the helper. Visible at a glance but not obtrusive.
- **Optimistic rendering.** Inbox/Dashboard show the queued capture immediately with a "syncing" indicator that clears on ack. Irretrievable failure (validation, expired auth) shifts the row to a "failed" state with a retry button.
- **"Invisible" mode is wrong.** Without a visible queue, the user discovers it the morning they're showing the dashboard to a peer and three items haven't synced.

### Observability

- **Per-client outbox inspection.** CLI: `compass outbox list/flush/clear`. Helper: an Outbox pane (pending count, last flush time, last error). PWA/web: Settings → Outbox page with manual retry/discard.
- **Server-side audit.** Captures table holds `client_id, captured_at, received_at, idem_key`. `SELECT (received_at - captured_at) AS lag FROM captures ORDER BY lag DESC LIMIT 50` instantly surfaces outliers (captures that sat in an outbox for hours/days).
- **Debugging "where did my capture go?"**: grep `~/.compass/outbox.jsonl` on the CLI, IDB inspector for web/PWA, `sqlite3 queue.db` for the helper. Every store is durable and inspectable.

### Security

- **Stolen laptop is a real risk.** Outbox may contain unfiled ideas, half-formed notes. CLI file is mode 0600 in a 0700 directory. Helper SQLite is in the OS-restricted Application Support path.
- **Encrypted-at-rest.** **macOS FileVault** is the realistic baseline — on by default on modern Macs, handles the at-rest case transparently. **SQLCipher** for the helper's queue (key in Keychain) is the v2 hardening if we ever ship to machines without FileVault (Linux port). **IndexedDB encryption** is snake oil unless you also encrypt the key, which forces a password prompt that violates capture-is-instant. Skip.
- **Auth tokens are stored separately** from the queue (`~/.compass/credentials.json` per Batch 5, Keychain for the helper). Never co-located.

### Migration / phasing

- **Option 1 → Option 2 is clean.** Server schema doesn't change; the only client change is "write to outbox first." No data loss because option 1 has no persistent client state. *But*: the first time a user loses a capture under option 1, trust erodes — code migration is trivial, trust recovery is not.
- **Per-surface rollout possible.** Could ship option 1 for web in week 1 and queue web in week 2 if budget tightens. CLI and helper are the surfaces most likely invoked offline and don't get to compromise.
- **Outbox schema versioning.** Each queue carries a version field (JSON column for CLI, `schema_version` row for SQLite, IDB version number for web/PWA). Flushers read old format, replay through new flow, delete old store.

### Edge cases

- **Large captures (pasted screenshot as data URL).** A pasted image easily 2–10MB base64. Flat-file (longer line), SQLite (TEXT), IDB (use Blob natively rather than re-encoding) all handle it. Flusher enforces the server's body limit at submit time — reject above 5MB with a clear UI message; don't silently queue something that will never drain. v2 should treat embedded images as a separate presigned-upload path with URL references in the markdown body.
- **Capture during server outage.** Queue locally, backoff, drain on recovery. User sees nothing. This is the headline win.
- **Capture during deploy.** Same. 60s deploy = at most one retry roundtrip after recovery; user never sees it.
- **Multiple clients online simultaneously after a long offline stretch.** All flush in parallel; server handles N concurrent POSTs; per-client unique constraints handle dedup. Cross-client "duplicates" (user captured the same thought on phone and laptop while both offline) become two real captures — they're independent intents.
- **Helper captures at 11:55pm, laptop sleeps before flush.** On wake, flusher drains; `captured_at` stays 11:55pm so the dashboard shows it on the right day.
- **User uninstalls a client with non-empty outbox.** Standard pattern: don't delete user data on uninstall. Clean reinstall warns explicitly that pending captures will be discarded.
- **Two CLI processes capturing concurrently.** Both append to outbox; atomicity via `O_APPEND` (small lines) or `flock()` (large). Single-process flusher enforced via lock file at `~/.compass/flusher.lock`.

### The PWA-specific "background sync vs in-flight at app-open" tradeoff

Its own subsection because iOS Safari catches everyone.

- **Service Worker Background Sync API** (Chromium, Firefox-ish, Edge): user submits → SW registers a sync tag → browser fires the `sync` event when connectivity returns, even with the PWA closed. Captures flush in the background.
- **iOS Safari: no Background Sync.** Apple has consistently declined to ship it for ~7 years. The SW can intercept fetches and write to IDB but can't be woken to drain an outbox. Only flush opportunity is when the PWA is foregrounded. Web Push only landed in iOS 16.4 and only for installed PWAs, and using it to "wake the client to send to the server" is a circular dependency that only works when the server is reachable anyway. Skip.
- **The right design assumes iOS as the baseline and uses Background Sync as a bonus.** Capture always lands in IDB; SW *also* registers a sync tag; SW's sync handler drains IDB; and on every page visibility/online event, the *page* also drains IDB. Same flusher code, two trigger contexts.
- **The "installed but never reopens" failure** still applies on iOS. Acceptable because (a) Compass is opened daily by product definition, (b) three other capture surfaces exist if something needs to land immediately.

### Verdict on option 2

Correct engineering answer for this product. Cost bounded (~5 days client + ~1 day server-side idempotency we'd want anyway). Buys: zero lost captures, instant UX everywhere, no behavioral split between online and offline. Pays forever: a queue inspector UI per client, doubled tests (online + offline path), small flusher state machine.

---

## Option 3 — Hybrid: CLI/helper queue locally, web/mobile fail loudly

The pragmatic middle. The argument: the user is *in front of* the browser when using the web app or mobile PWA, so a failure is immediately visible and recoverable. The CLI and helper are most likely to be used in flaky-connectivity contexts and benefit most from a queue. Save the work of building IndexedDB queues for web/PWA and only build the SQLite/flat-file queues for the native clients.

### Implementation cost per client

- **Web app:** synchronous, no queue. ~0.5 day.
- **CLI:** flat-file outbox. ~1 day.
- **Mobile PWA:** synchronous, no queue, error UI on fail. ~0.5 day.
- **Menubar helper:** SQLite-on-disk queue. ~1.5 days.

**Total:** ~3.5 days. Saves ~1.5 days vs. option 2 (web + PWA queueing is the work avoided).

### Idempotency design

Same as option 2 for the CLI/helper. Web/PWA don't strictly need it (no retries), but you'd still send a client-generated UUID so a desperate user double-clicking submit doesn't create dupes. Server-side dedup story is identical (the table doesn't care which client it came from; idem keys are per-client).

### Replay ordering

Same answer: doesn't matter for Compass.

### Failure modes

- **Web/PWA lose captures on transient network failure** — same as option 1, scoped to two surfaces.
- **Surface inconsistency.** Web users develop one mental model ("if I see the success message, it's saved"); CLI users a different one ("always succeeds locally, eventually syncs"). Crossing surfaces surprises them. Mental-model inconsistency is a real UX cost.
- **Mobile PWA is the worst hit** — worst expected connectivity, least likely to retry a failed capture (one-handed, distracted). Synchronous-on-mobile is the highest-impact place to fail loudly.
- Other failure modes track option 2 within CLI/helper, option 1 within web/PWA.

### UX implications

- **Two-speed product.** CLI feels bulletproof; web/PWA feel "normal" web-app fragile. The CLI becomes the trusted capture path and the web app drifts in feel.
- **Violates PRD's instantness on mobile**, the surface most explicitly designed for capture (PRD §11). If mobile capture is fragile, mobile is broken.

### Observability, security, migration, edge cases

- **Observability is inconsistent** — outbox inspection on CLI/helper, none on web/PWA.
- **Security:** marginally smaller attack surface than option 2 (less queued data at rest).
- **Migration:** the option 1 → option 3 → option 2 progression is real, but "transitional" hybrids tend to become permanent because no one spends a week upgrading web queueing once things "mostly work."
- **Edge cases:** CLI/helper behave per option 2, web/PWA per option 1. The deploy-window failure is asymmetric — invisible to CLI/helper, visible to web/PWA. For a single-user product where *you* deploy *and* you use the web app, you eat the error every time you ship.
- **PWA tradeoff:** doesn't apply in this option — PWA is synchronous.

### Verdict on option 3

Defensible compromise for a different product. For Compass it loses on the surface (mobile) where queueing matters most and creates a two-speed mental model. Savings (~1.5 days) not worth the inconsistency.

---

## Capture-flow architecture sketch (chosen design)

```
              +--------------------+ +--------------------+
              |   Web app (PWA)    | |   Menubar helper   |
              | IndexedDB outbox   | | SQLite outbox      |
              | + optional SW sync | | + global hotkey UI |
              +---------+----------+ +----------+---------+
                        |                       |
              +---------v----------+ +----------v---------+
              | CLI binary         | | Mobile PWA (iOS)   |
              | ~/.compass/        | | IndexedDB outbox   |
              | outbox.jsonl       | | (no SW sync)       |
              +---------+----------+ +----------+---------+
                        |                       |
                        |   HTTPS POST          |
                        |   /api/v1/captures    |
                        |   bearer token        |
                        |   + idem_key          |
                        |   + captured_at       |
                        v                       v
              +-----------------------------------------+
              |  Server (Fly/Render, Next.js handler)   |
              |  - validates bearer + payload           |
              |  - UNIQUE(client_id, idem_key)          |
              |  - inserts capture row                  |
              |  - emits activity_event                 |
              |  - returns 200 with row id              |
              +--------------------+--------------------+
                                   |
                                   v
              +-----------------------------------------+
              |  SQLite (Litestream → R2) OR Postgres   |
              |  captures, activity_event, ...          |
              +-----------------------------------------+

Per-capture lifecycle:
  1. User hits enter → client generates ULID idem_key + captured_at (client clock).
  2. Client writes {idem_key, client_id, captured_at, content} to local outbox
     with durable commit (fsync / tx.complete / PRAGMA synchronous=FULL).
  3. UI returns optimistic success; item appears with "syncing" badge.
  4. Flusher POSTs with exponential backoff (1s → 5min cap, infinite while queued).
  5. On 200 (incl. idem-key collision): drop outbox row, clear badge.
     On 401: pause, surface re-login prompt.
     On other 4xx: mark row failed, expose retry/edit/discard in the outbox UI.
```

---

## Why option 2 won for Compass

Three reasons compound:

**1. Capture is the central UX commitment.** PRD §7's first principle ("Capture must be instant") and §10's first success metric ("capture rate — ideas, notes, and curiosities are logged here rather than lost elsewhere") both fail loudly under option 1 and partially under option 3. There is no honest reading of the PRD where synchronous capture satisfies these on flaky networks. The single-most-important UX promise cannot be at the mercy of the network.

**2. Production-extensible quality bar (F3).** We told ourselves no shortcuts that compound into rewrites. Option 1 is a shortcut that compounds: the first lost capture erodes trust; rebuilding it is expensive. Option 3 leaves two surfaces on the unreliable path and creates a two-speed mental model. Option 2 is the version we'd build in v1.0 of any production product where capture loss is unacceptable — pay ~5 days now rather than retrofit after shipping a fragile baseline.

**3. Multi-client architecture (F4).** Four capture surfaces, three of which (CLI, helper, mobile PWA) live in uncertain-connectivity contexts. The CLI runs on a laptop that lives on planes. The helper fires on global hotkey at any moment, including the moment after wake when wifi hasn't reconnected. The PWA is mobile. Synchronous-only on any of these is a UX regression compared to the scattered tools Compass is replacing (sticky notes work offline) — the product has to be at least as reliable as what it displaces.

Two corroborating gifts make option 2 cheaper here than elsewhere:

- **No general sync engine needed.** No edit-conflict problem; server is canonical, clients are thin. Queueing only applies to inserts, which are commutative and idempotent. We use a queue instead of a CRDT and skip ~95% of the complexity people associate with "offline-first."
- **Capture is order-independent.** No replay-ordering bugs. The outbox is a multiset, not an event log. Drain in any order, from any number of clients in parallel — result is the same.

---

## Verdict for Compass

Adopt **option 2: all clients queue locally and replay when online.** Build in week 1, on the same schedule as capture. Implementation summary:

- **Web app:** IndexedDB outbox + `online` listener + Settings → Outbox inspector. Optimistic UI; "outbox: N pending" badge when non-empty.
- **CLI:** `~/.compass/outbox.jsonl` with `O_APPEND` + `fsync`, single-process flusher gated by `~/.compass/flusher.lock`. `compass outbox list/flush/clear` subcommands.
- **Mobile PWA:** IndexedDB outbox (durable); Service Worker Background Sync as opportunistic accelerator (graceful no-op on iOS); flush on visibility/online. PWA install + share-target both write to the same queue.
- **Menubar helper:** SQLite queue at OS Application Support path with `synchronous=FULL` + WAL. Menubar pulses when non-empty.
- **Server:** capture endpoint with `UNIQUE(client_id, idem_key)`; idempotent insert returning 200 on first write or collision. `captured_at` is user-facing; `received_at` is for skew detection/audit. Activity events keyed off the same idem_key so replay never produces duplicates (matters because stall logic and Telegram digest read activity events).
- **Security:** mode 0600 files (CLI) / OS-restricted (helper); FileVault is the at-rest baseline; SQLCipher considered for v2.
- **Migration safety:** all outbox formats versioned; flushers can read prior schema and migrate forward.

Incremental cost above synchronous baseline: ~5 days client + ~1 day server-side idempotency. Worth every hour.

The single failure we haven't solved: user uninstalls a client with non-empty outbox and discards their data. Addressed by explicit uninstaller warnings and surfacing outbox depth in every client UI; beyond that, user's call.

Everything else — lost-capture, double-capture, deploy-window, flaky-wifi, sleeping-laptop, jet-lagged-travel, two-terminals-concurrent — is handled by the queue.
