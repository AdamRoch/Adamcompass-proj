# @compass/helper

The Compass menubar helper. A tray-only macOS app (Tauri 2 + React) that owns
a global hotkey for instant capture and POSTs to a running Compass server.

PRD: see `docs/Compass-Implementation-PRD.md` §8.4.

## Platform status

| OS      | Status                                                  |
|---------|---------------------------------------------------------|
| macOS   | Primary target (week 1).                                |
| Linux   | Deferred to week 2. Tray + hotkey will need OS-specific work. |
| Windows | Deferred to week 2.                                     |

The Rust code compiles cross-platform but the tray positioning,
activation-policy gating, and `cmd_open_url` are macOS-only today. Don't
expect a usable tray icon on Linux/Windows yet.

## Requirements

- macOS 11+
- pnpm 9, Node 22
- Rust toolchain (stable, latest). Install with `rustup`.
- Xcode Command Line Tools (for the system linker + WebKit headers).

```bash
xcode-select --install   # if you haven't already
rustup toolchain install stable
```

## Develop

```bash
# from the monorepo root
pnpm install

# run the helper in dev (Vite + cargo + tray)
pnpm --filter @compass/helper tauri:dev
```

On first launch you'll see a tray icon (a small compass) and **no dock icon
and no main window** — that's by design.

- Press `Option+Space` (default hotkey) → popover opens near the menubar.
- Type something, hit `Enter` → it POSTs to `${base_url}/api/v1/captures`.
- `Esc` dismisses without sending.
- Click the tray → menu with "Capture…", "Open Compass", "Settings", "Quit".

### Type hints

The popover uses a tiny prefix convention so you don't have to think about it:

| Prefix | type_hint  |
|--------|------------|
| `! `   | `idea`     |
| `? `   | `curiosity`|
| (none) | `note`     |

Reclassify later from the web app's Inbox.

## Configure

Open **Settings** from the tray menu. You need:

1. **Base URL** — where your Compass server lives (e.g.
   `https://compass.example.com` or `http://localhost:3000` for dev).
2. **Bearer token** — create one at `/settings/tokens` in the web app with
   the `helper` scope, then paste it here.
3. **Hotkey** — defaults to `Alt+Space`. See "Hotkey rebinding" below.

"Test connection" hits `GET /api/v1/settings` and reports the round-trip.

The config is stored at
`~/Library/Application Support/compass-helper/config.json`. The outbox
SQLite database lives in the same directory at `outbox.sqlite`.

## Hotkey rebinding

Tauri shortcut syntax: tokens joined by `+`. Examples:

- `Alt+Space` (default)
- `CommandOrControl+Shift+C`
- `Super+J`
- `F12`

Accepted modifiers: `Cmd`/`Command`/`Super`/`Meta`, `Ctrl`/`Control`,
`Alt`/`Option`/`Opt`, `Shift`, plus the cross-platform `CommandOrControl`
alias.

Accepted keys: A–Z, 0–9, `Space`, `Enter`, `Tab`, `Esc`, arrows,
`Backspace`/`Delete`, `Home`/`End`, `PageUp`/`PageDown`, `F1`–`F12`.

Mechanics: the Settings "Rebind" button calls a Rust IPC command that
unregisters the previous accelerator (`unregister_all`) and registers the
new one via `tauri-plugin-global-shortcut`. If the OS already owns the
combo (e.g. Spotlight on `Cmd+Space`), registration fails and the error
surfaces inline; nothing else changes.

## Outbox

Every capture writes to a local SQLite outbox **only on send failure**
(network down, 5xx, etc.). A Rust background task drains the queue every
10 seconds:

- On `2xx` or `409` (idempotency hit) → row deleted.
- On `4xx` other than `409` → attempts counter incremented; row kept so
  the user can investigate.
- On network error → attempt recorded, the rest of the batch is skipped
  for this tick.

Stats are visible in Settings ("Pending", "last attempt", "last error").

The queue is **not encrypted at rest** in v1 (PRD §14 — flagged as a v2
hardening item).

## Autolaunch at login

The Settings page has an "Open Compass Helper at login" checkbox. It
toggles via `tauri-plugin-autostart`, which installs a `LaunchAgent` plist
under `~/Library/LaunchAgents/`. Removing the toggle removes the plist on
next save.

## Build

```bash
pnpm --filter @compass/helper tauri:build
```

Output goes to `apps/helper/src-tauri/target/release/bundle/`:
- `macos/Compass Helper.app` — the unsigned `.app` bundle.
- `dmg/Compass Helper_0.1.0_aarch64.dmg` — drag-installer.

## Tray icon

Ships with a tiny placeholder PNG (a compass rose, 16×16 base, 32/128/256
for the app bundle). It's a template image so macOS tints it for light/dark
menubars. **It's a programmatically-generated placeholder** — replace
`apps/helper/src-tauri/icons/*.png` with your real assets before
distributing.

## Troubleshooting

- **Hotkey does nothing**: another app already owns the combo (try
  `CommandOrControl+Shift+K`), or you haven't approved the helper under
  System Settings → Privacy & Security → Accessibility (rare; only some
  combos require this on recent macOS).
- **"capture rejected (401)"**: token's wrong. Mint a new `helper`-scope
  token in the web app's Settings → Tokens.
- **Popover doesn't appear**: it's a transparent always-on-top window; if
  it's hidden behind another full-screen app, switch desktops or use the
  tray menu's "Capture…" item to re-trigger.
- **Outbox not draining**: check Settings → Outbox for the last error.
  Most common: base URL is empty or the server cert isn't trusted.
- **First `tauri dev` is slow**: Cargo is compiling the WebKit shim and
  `rusqlite` (bundled SQLite). Subsequent runs are seconds, not minutes.

## Out of scope (v1)

- DMG signing / notarization. The unsigned `.app` will prompt Gatekeeper
  on first launch. Future work.
- Linux/Windows support.
- Encrypted outbox.
- Tests (add Vitest/Rust integration when time permits).
