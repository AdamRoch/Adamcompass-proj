# @compass/cli

The `compass` CLI — capture from any terminal.

## Install

From source (workspace dev):

```bash
pnpm install
pnpm --filter @compass/cli typecheck
pnpm --filter @compass/cli dev -- --help
```

Once on `$PATH` (after `pnpm link` or after building a standalone binary), invoke:

```bash
compass --help
```

## Quick start

```bash
# 1. Point the CLI at your server
export COMPASS_BASE_URL=https://compass.example.com

# 2. Authenticate (opens a browser to approve the device code)
compass login

# 3. Capture
compass capture "ship the auth changes" --type idea --tag work
echo "pipe-friendly too" | compass capture

# 4. See what's there
compass list
compass status
```

## Commands

| Command          | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `compass capture <text>` | Send a capture (queued + retried on failure). Reads stdin if no positional. |
| `compass login`          | Device-code flow → token saved to `~/.compass/credentials.json` (0600).     |
| `compass list`           | Recent captures + recent projects + recent goals (pretty tables).            |
| `compass status`         | Base URL, login state, outbox length, last server contact, dialect.          |
| `compass logout`         | Best-effort token revoke + delete local credentials.                         |

`capture` flags:

- `--type idea|note|curiosity|unspecified` (default `unspecified`)
- `--tag <name>` (repeatable)
- `--project <ulid>` (file directly into a project, skipping the inbox)

## Config & storage

| Path                            | Contents                                                  |
| ------------------------------- | --------------------------------------------------------- |
| `~/.compass/credentials.json`   | `{ base_url, token, last_contact_at, label }`. Mode 0600. |
| `~/.compass/outbox.ndjson`      | One JSON object per line (queued captures).               |

Base URL resolution order:

1. `COMPASS_BASE_URL` env var (if set and non-empty)
2. `base_url` from the credentials file

If neither is set, commands fail with a friendly hint.

## Outbox semantics

- Every `compass` invocation (except `login` / `logout`) first tries to drain the outbox.
- Each capture gets a stable `idem_key` (UUID v4) generated **once on enqueue** and reused on every replay — the server dedupes on `(client_id, idem_key)`.
- A line is removed only after the server responds 2xx or 409. Network errors / 5xx leave the line in place; permanent 4xx (validation/auth) drop the line with a warning so a single bad entry doesn't wedge the queue.
- The newest capture is sent inline; on failure it's queued and the user sees `queued (...)` instead of `captured`.

## Dev

```bash
# Run the TS entry directly (tsx via node loader)
pnpm --filter @compass/cli dev -- capture "hello"

# Type-check
pnpm --filter @compass/cli typecheck

# Build JS (for `node ./dist/index.js`)
pnpm --filter @compass/cli build

# Build standalone binaries (requires `bun` installed locally)
pnpm --filter @compass/cli compile
# → dist/compass-macos-arm64, dist/compass-macos-x64, dist/compass-linux-x64
```

## Notes

- Windows is not packaged in `compile` (week-2+ deliverable per the PRD); `pnpm dev` still works on Windows for development.
- The CLI doesn't depend on the web app — only on the shared `@compass/api-client` and `@compass/shared` workspace packages.
