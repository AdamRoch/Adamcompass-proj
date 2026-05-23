# Framework Comparison for Compass

**Decision:** Next.js App Router
**Date:** 2026-05-23
**Status:** Retrospective — written after the decision was made, to document the reasoning thoroughly so future projects benefit from the same analysis.

---

## Why this document exists

The Next.js choice is locked. The point isn't to relitigate it — it's to build a real map of the decision space so the next time a project hits the same fork (server-rendered web app, public API surface, multiple thin clients, dual-DB story), you can recognize which shape fits and *why*.

The four candidates worth taking seriously were:

1. **Next.js App Router** — chosen.
2. **Vite + React SPA + a separate Hono/Express server.**
3. **SvelteKit.**
4. **Remix / React Router v7.**

Compass's constraints, condensed: three thin clients plus a server (web, CLI, menubar helper, mobile PWA install), public HTTPS on Fly.io or Render, both a bearer-token `/api/v1/*` and an HMAC-signed `/webhooks/*` coexisting with a cookie-session browser UI, dual-DB (SQLite + Litestream out of the box, full Postgres swappable via env) with per-dialect Drizzle schemas, Radix primitives + Tailwind (no shadcn) with five themes via CSS variables, production-extensible quality bar. Capture-first UX, dashboard second, server-rendered HTML with progressive enhancement is fine.

---

## Option 1: Next.js App Router

### Dual surface (session UI + bearer API + HMAC webhook)

Next.js App Router treats `app/**/route.ts` as first-class HTTP route handlers. They run the same way whether rendering HTML, mutating via server actions, serving JSON for the CLI, or accepting an HMAC-signed webhook. `middleware.ts` runs on every request before route resolution and dispatches:

- `/api/v1/*` → require bearer token, return JSON.
- `/webhooks/*` → require bearer + verify HMAC over raw body.
- everything else → session cookie, redirect to login if missing.

The raw request body is accessible (`await req.text()` then JSON-parse), which is necessary for HMAC verification — you can't hash a parsed JSON object and get the same signature the sender computed. App Router gets this right; the older Pages Router required disabling the body parser explicitly.

Server actions handle internal browser mutations without inventing a JSON API for things only the UI calls. That keeps `/api/v1/*` honest — it carries only what the CLI, mobile, helper, and future agent actually need.

### SSR vs SPA, applied to the dashboard

The dashboard is read-heavy: momentum strip, needs-attention, this-week, counts. With data on the same machine as the server, server-rendering is essentially free — one DB round-trip, render, ship HTML. No skeleton loaders, no `useEffect` initial fetch. Inbox is the same shape.

Progressive enhancement covers the interactive bits (snooze picker, capture modal, theme switcher, ⌘K palette). The capture flow is a form post → server action → revalidate. That's the interaction model for 80% of the app.

### Deployment on Fly.io / Render

Standalone output produces a self-contained Node server. Both hosts run it via a thin Dockerfile or buildpack and support persistent volumes (Fly's `[mounts]`, Render's disks), which matters for SQLite + Litestream. Cold start on a Fly micro VM is ~300–600ms — not edge-fast, but irrelevant for a single-user app.

One gotcha: don't turn on Vercel edge runtime for the webhook routes. They need Node for `crypto` (HMAC) and Drizzle's native SQLite driver. Pin `export const runtime = 'nodejs'` and move on.

### TypeScript with Drizzle

Per-dialect schemas (`schema.sqlite.ts` and `schema.pg.ts`) are just modules. A `packages/db/index.ts` that switches on `DB_DIALECT` and exports a typed client works. Drizzle's query types are good enough that the UI layer doesn't have to know which dialect is live.

Server actions give end-to-end type inference — the function signature on the server is the signature on the client, because the client is generated from it. A real DX win over a separate API client for internal mutations.

### Radix + Tailwind, no shadcn

Radix primitives are client components (event handlers, refs), so anything wrapping a Radix Dialog needs `"use client"` somewhere in the subtree. Small mental tax: you compose pages by deciding which subtree needs interactivity. Fine for Compass — most pages are server-rendered with a few interactive islands.

Hand-building the component inventory on Radix is the same amount of work in every framework here.

### Mobile PWA

No first-party PWA story, but `next-pwa` or a hand-rolled `app/manifest.ts` + service worker works. Share-target lives in the manifest. The interesting work — IndexedDB outbox, replay-on-reconnect — is framework-agnostic SW code.

Wart: `next dev` doesn't serve the SW by default, so PWA testing means `next build && next start` locally or a dev-mode shim.

### Bundle size + cold start

Heaviest of the four. Minimal App Router ships ~80–120KB before app code; the dashboard with cmdk and a couple of Radix primitives lands around 150KB first-load. Fine on broadband, mediocre on LTE. Server cold start a few hundred ms.

### Adding the four side-systems

- **Telegram scheduler (node-cron):** Singleton imported at startup via `instrumentation.ts` — Next has a documented hook for this.
- **FTS5 / tsvector search abstraction:** `SearchProvider` interface in `packages/db`, framework-independent. Drizzle exposes raw SQL for FTS5 `MATCH` queries.
- **Webhook routes:** First-class.
- **Monorepo:** Plays well with pnpm workspaces. `apps/web` imports `@compass/db`, `@compass/api-client`, `@compass/shared`. Turbopack handles workspace resolution in dev.

### Frustrations in week 1

- The server/client component split is clean conceptually but annoying in practice — forget a `"use client"`, get a cryptic error. Learning-curve tax.
- `next dev` can be slow to recompile large routes the first time. Turbopack helps but isn't fully stable for every plugin.
- The framework assumes Vercel — leaks into docs, examples, and a few defaults (image optimizer, analytics SDK). On Fly/Render you reconfigure or disable.

### What it unlocks vs the alternatives

- Server actions as the internal mutation primitive — no hand-written API for things only the UI calls.
- One process, one deploy, one URL for browser + API + webhook. Zero CORS config.
- React Server Components for dashboard reads — data never round-trips to the client as JSON.
- The largest ecosystem of "I want to add X" recipes, which matters when you're building boring infrastructure under time pressure.

---

## Option 2: Vite + React SPA + separate Hono (or Express) API server

The "two boxes" option: Vite SPA in one deploy, Hono server in another (or two processes behind a shared proxy).

### Dual surface

Hono is a fantastic small server framework. Bearer auth, HMAC verification, JSON responses — all clean and obvious. Full control over the raw body. For the webhook surface specifically, this is the most pleasant of the four.

The session UI side is where the shape gets awkward. The SPA is a separate origin (or same origin if you proxy carefully), and there are no "server-rendered" pages — it boots, fetches `/api/v1/me`, renders the shell, fetches the route. You can SSR with Vite via `vike`, but then you've reinvented a meta-framework and lost the "small and obvious" appeal.

CORS becomes a real concern if SPA and API are on different origins. You'd usually proxy to one origin to avoid it — more deploy config to maintain.

### SSR vs SPA on the dashboard

The biggest mismatch. Compass's dashboard wants HTML on first paint with data in it. A SPA fetches JSON after boot, which means a skeleton state on every load, capture is JS-driven (not a plain form post), and bookmark / share / cold-load all hit a loading state. Survivable for a single-user pinned tab, but the PRD explicitly calls for "scannable, surfaces signal over noise." SSR is a better fit.

### Deployment

Two artifacts: static SPA bundle + Hono server. Fly.io and Render both handle this as two services or one container. Slightly more config to maintain (env vars in two places, separate build steps, separate logs).

### TypeScript with Drizzle

Drizzle lives in the Hono server. Pure win — no client/server confusion, clear boundary. The SPA gets a typed API client via Hono's RPC mode (`hc<typeof app>(...)`), which is genuinely nice: define routes on the server, client gets `client.api.v1.projects.$get()` typed inference. CLI and helper share that client too.

### Radix + Tailwind

Identical. Radix is React; works in any React shell.

### Mobile PWA

`vite-plugin-pwa` is solid. The SPA model actually fits PWA more naturally than SSR — shell cached, data fetched, offline-first is straightforward. For a flaky-network mobile app this would be a win.

### Bundle size + cold start

Smallest client bundle of the four — Vite + React + Radix lands under 80KB first-load with tree-shaking and lazy routes. Hono cold start is ~50ms, much faster than Next.

### Side-systems

- **Telegram scheduler:** Trivially a `node-cron` module imported at Hono startup. Cleanest of the four.
- **Search abstraction:** Same interface, same impls. Framework-irrelevant.
- **Webhook routes:** First-class and pleasant in Hono.
- **Monorepo:** Possibly the cleanest fit — `apps/web` (Vite), `apps/api` (Hono), `apps/cli`, `apps/helper`. Web/API split is already there.

### Frustrations in week 1

- Manual API client even with Hono RPC: the SPA still needs loading states everywhere, optimistic updates, error toasts on fetch failure. Server actions + revalidation in Next handle most of this for free.
- Two deploys to keep in sync (versions, env vars, secrets).
- No SSR for the dashboard hurts first-load and no-JS fallback.
- Auth state sync between SPA and API: handle session expiry, 401 redirects, etc. Next handles this in middleware.

### What it unlocks vs the alternatives

- The smallest, fastest, most boring server possible. Hono is a pleasure.
- A dramatically faster dev loop — Vite's HMR is in a different league.
- A clean conceptual separation between API and UI that scales better as more clients arrive (Compass will have three).
- The API can run on Cloudflare Workers / Deno Deploy if we ever want edge. Next can do edge with caveats; Hono is native there.

---

## Option 3: SvelteKit

### Dual surface

`+server.ts` files are route handlers, similar to App Router. The form-action model (`+page.server.ts`) is arguably nicer than React server actions — it works without JS, real progressive enhancement. `hooks.server.ts` dispatches auth (cookie vs bearer vs HMAC). Raw body access works for HMAC.

### SSR vs SPA on the dashboard

SvelteKit's default is SSR with hydration, same as App Router. Dashboard would server-render just as cleanly. Svelte's hydration is 30–50% smaller for the same UI.

### Deployment

`adapter-node` produces a standalone Node server, runs anywhere. Fly.io and Render both work. Same shape as Next standalone, smaller and faster to start.

### TypeScript with Drizzle

Works identically. Svelte's type inference for forms and load functions is slightly less mature than React+TS for server actions but close. Nothing blocking.

### Radix + Tailwind — the real problem

Radix is React-only. SvelteKit means losing Radix. The Svelte alternatives:

- **`bits-ui`** — Radix-style port, smaller community, less mature.
- **`melt-ui`** — builders pattern (not components), lower-level, more wiring per primitive.
- **`shadcn-svelte`** — we already chose no-shadcn.

For a production-extensible quality bar with five themes and custom design, building on `melt-ui` is a different bet than Radix. Radix's accessibility primitives are battle-tested in a way the Svelte equivalents aren't yet. Matters less for a personal tool, but it's real.

### Mobile PWA

`@vite-pwa/sveltekit` works. Same shape as the Vite story. Smaller hydration cost is a real win on mobile.

### Bundle size + cold start

Smallest server bundle, smallest client JS of the four. A dashboard with form actions, theme switcher, ⌘K palette could land under 60KB first-load. Cold start under 200ms.

### Side-systems

- **Telegram scheduler:** `hooks.server.ts` startup or a separate worker. Slightly less obvious than Next's `instrumentation.ts` but fine.
- **Search abstraction:** Framework-agnostic.
- **Webhook routes:** First-class.
- **Monorepo:** Works, no opinion on workspace shape.

### Frustrations in week 1

- **Losing Radix is a real loss.** Rebuilding primitives on `melt-ui` or against ARIA spec — themes and design quality would land later with less confidence in edge cases.
- Smaller ecosystem of "boring infrastructure" recipes. Auth, file upload, etc. all exist but fewer pre-baked solutions.
- React muscle memory doesn't transfer. Svelte is easy but "easy" still costs days.
- Less commonly-used means more "read the source to figure out why this works."

### What it unlocks vs the alternatives

- Best progressive-enhancement story of the four. Forms work without JS by default.
- Smallest, fastest client.
- A genuinely pleasant template language — complicated UI in less code than React.
- Cold starts so fast they don't matter.

---

## Option 4: Remix / React Router v7

### Dual surface

Remix's model is "loaders for reads, actions for writes, resource routes for arbitrary endpoints." A resource route returns a Response instead of a UI — perfect for `/api/v1/*` and `/webhooks/*`. Dispatch is by route file, no separate API folder.

`createCookieSessionStorage` is first-party for session UI. Bearer-token auth goes in the loader/action. HMAC for webhooks: `await request.text()` in the resource route.

Remix's mental model — "the web platform is a request/response cycle, build on top of it" — is the closest fit to what Compass actually is. If you like the platform, Remix feels like coming home.

### SSR vs SPA on the dashboard

SSR-first like App Router. Loader runs on the server, returns data, route renders to HTML, hydration after. Dashboard renders fast, no skeleton states.

No React Server Components — every component is regular React, data comes from loaders. For Compass this is *simpler* than App Router's client/server split. No deciding which components can be server-only.

### Deployment

`@remix-run/node` produces a standard Node server. Fly.io and Render handle it identically to Next standalone. Cold start faster than Next (no RSC overhead), slower than SvelteKit.

### TypeScript with Drizzle

Excellent. `useLoaderData<typeof loader>()` and `useActionData<typeof action>()` give end-to-end inference. No separate API client for the UI's own mutations. Per-dialect Drizzle schemas plug in the same way.

### Radix + Tailwind

Identical to App Router. Slight benefit: no client/server component split to think about, so composing Radix primitives is more straightforward.

### Mobile PWA

Less first-party PWA support than Next or Vite. Hand-rolled service worker and manifest. Doable but more work.

### Bundle size + cold start

Smaller than Next, larger than SvelteKit. ~70–90KB first-load. Cold start ~250ms.

### Side-systems

- **Telegram scheduler:** Singleton in `entry.server.ts` or a separate entry point. Slightly clumsier than `instrumentation.ts` but workable.
- **Search abstraction:** Framework-agnostic.
- **Webhook routes:** Resource routes are first-class.
- **Monorepo:** Works fine with pnpm workspaces.

### Frustrations in week 1

- **Version politics.** Remix merged into React Router v7. The story is "React Router v7 framework mode == Remix v3." Docs split across two repos, recipes online may be for Remix v2, package names changed (`@remix-run/*` vs `react-router`). Some "which docs do I trust today" friction.
- Smaller ecosystem than Next. Fewer auth recipes, fewer deploy guides.
- PWA is roll-your-own, not a plugin.

### What it unlocks vs the alternatives

- The cleanest mental model of the four for "web app with form posts." No client/server split, no server actions vs API routes distinction — just loaders, actions, resource routes.
- Better progressive enhancement than Next by default — forms work without JS in more cases.
- Smaller, faster than Next without sacrificing the React ecosystem (unlike SvelteKit).
- A community that tends to write careful code and value the web platform — recipes tend to be high-quality.

---

## Why Next.js App Router won here

Next isn't the best framework in the abstract. It was the best fit for how Compass's constraints stack up.

**1. One process, one URL, three surfaces.** Webhook, API, and UI share a DNS name. Vite + Hono splits into two deploys and a proxy. SvelteKit and Remix can do one-process too — they're not worse here. But Next has the largest install base on Fly.io and Render, and "boring deployment" matters when the budget is one week.

**2. Server actions remove a whole layer of code for internal mutations.** Vite + Hono forces you to invent and maintain a JSON API for everything the UI does, including things only the UI does. SvelteKit form actions and Remix actions are similar to server actions — wash among the three SSR options.

**3. Radix rules out SvelteKit.** Five themes, liquid-glass, custom design system, no shadcn, production-extensible quality — Radix's battle-tested accessibility primitives de-risk that work significantly. `melt-ui` and `bits-ui` are real but younger; betting on them in week 1 alongside everything else is risk we don't need.

**4. SSR for the dashboard is the right shape.** Read-heavy, server-data, computed views. SSR means HTML lands with data in it — no skeleton, no waterfall. This eliminates SPA. Vite + React without `vike` is out; with `vike` you've reinvented a meta-framework.

**5. The dual-DB and the four side-systems are framework-agnostic.** Drizzle per-dialect, `SearchProvider` interface, scheduler module, webhook routes, monorepo — all work in any of the four. Not a tiebreaker; Next wins marginally on `instrumentation.ts` for the scheduler hook.

**6. The deciding margin among Next / Remix / SvelteKit was ecosystem depth.** When you're building four side-systems and three clients in a week, you can't afford to be the person discovering an unwritten integration. Remix is the close runner-up — arguably cleaner mental model — but smaller ecosystem and the v2-to-v7 transition add friction we don't want this week.

**7. Framework is the hardest choice to undo.** DB can be swapped (it literally is). Search has an interface. UI components can be re-themed. Changing the framework in week 3 means rewriting routing, mutations, deploy config, and probably auth. Bias toward the choice with the most escape hatches and largest community.

---

## What we're explicitly giving up

- **A smaller, faster client.** SvelteKit or Vite would ship less JS. Fine for a personal tool; would matter more public-facing.
- **The cleanest progressive-enhancement story.** SvelteKit and Remix degrade more gracefully without JS than React server actions.
- **A pleasant CLI-style API server.** Hono is a joy. Next route handlers are fine but unexceptional.
- **Faster dev recompiles.** Vite HMR is in a different league. `next dev` is acceptable.
- **Smaller cold starts.** SvelteKit and Hono boot faster than Next. Doesn't matter at our scale.

None are decisive. Real costs paid for "boring choice that gets to v1."

---

## Verdict for Compass

Pick Next.js App Router because:

1. SSR matches the dashboard's read-heavy shape.
2. Server actions + route handlers handle the dual surface (session UI + bearer API + HMAC webhook) in one process, on one URL, with no CORS.
3. Radix — required for our five-theme liquid-glass design with no shadcn — pulls us to React, which rules out SvelteKit.
4. Ecosystem depth means the four side-systems all have well-trodden paths.
5. Fly.io and Render both deploy Next standalone trivially with the persistent volume SQLite + Litestream needs.

Remix / React Router v7 was the close second. We didn't pick it because of the v2-to-v7 doc friction in week 1 and the smaller ecosystem for boring infrastructure.

Vite + Hono lost on dashboard shape (SPA vs SSR) and the cost of two deploys.

SvelteKit lost on Radix.

For a future project where the dashboard is more interactive, the design system is less custom, or the team has Svelte expertise, the calculus shifts. This document exists so that calculus can be made consciously next time.
