// Compass Menubar Helper — Tauri 2 entrypoint.
//
// What this file does, top to bottom:
//   1. Defines the persisted on-disk config struct (`HelperConfig`) and the
//      SQLite-backed outbox (`Outbox`) — both live under the OS-appropriate
//      app-data directory.
//   2. Exposes IPC commands the JS side calls: load/save config, rebind
//      hotkey, show/hide popover, open settings, enqueue capture, stats.
//   3. Builds the Tauri app: tray icon + menu, registers the global shortcut,
//      sets the macOS activation policy to `Accessory` (so we never get a
//      dock icon or main window), and spawns a background task that drains
//      the outbox every 10 seconds.
//
// macOS-first by design. The CFG gates around mac-only behavior are minimal:
// the activation policy + tray geometry are mac-only; everything else
// (sqlite, hotkey, HTTP) is portable. Linux/Windows will need their own
// tray-positioning code in week 2.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{Menu, MenuEvent, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Runtime,
    WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// ============================================================================
// Config
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelperConfig {
    pub base_url: String,
    pub token: String,
    pub hotkey: String,
    pub client_id: String,
    pub autostart: bool,
}

impl Default for HelperConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:3000".to_string(),
            token: String::new(),
            hotkey: "Alt+Space".to_string(),
            client_id: default_client_id(),
            autostart: true,
        }
    }
}

fn default_client_id() -> String {
    let host = hostname_short();
    format!("helper-{}", host)
}

fn hostname_short() -> String {
    // Best-effort short hostname; we don't depend on the `hostname` crate so we
    // poke /etc/hostname on unix and fall back to a generic label.
    std::env::var("HOST")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .or_else(|| std::fs::read_to_string("/etc/hostname").ok())
        .map(|s| s.trim().split('.').next().unwrap_or("device").to_string())
        .unwrap_or_else(|| "device".to_string())
}

fn app_data_dir() -> Result<PathBuf> {
    // We deliberately don't take a PathResolver here so the helper can compute
    // its config path without an AppHandle in scope (the replay thread needs
    // the same path).
    let base = dirs::config_dir().ok_or_else(|| anyhow!("no config dir"))?;
    let dir = base.join("compass-helper");
    std::fs::create_dir_all(&dir).with_context(|| format!("mkdir {:?}", dir))?;
    Ok(dir)
}

fn config_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("config.json"))
}

fn db_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("outbox.sqlite"))
}

fn read_config_from_disk() -> HelperConfig {
    let path = match config_path() {
        Ok(p) => p,
        Err(_) => return HelperConfig::default(),
    };
    match std::fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => HelperConfig::default(),
    }
}

fn write_config_to_disk(cfg: &HelperConfig) -> Result<()> {
    let path = config_path()?;
    let json = serde_json::to_string_pretty(cfg)?;
    std::fs::write(&path, json).with_context(|| format!("write {:?}", path))?;
    Ok(())
}

// ============================================================================
// Outbox
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct OutboxStats {
    pub pending: i64,
    pub last_attempt_at: Option<String>,
    pub last_error: Option<String>,
}

pub struct Outbox {
    conn: Mutex<Connection>,
    last_attempt: Mutex<Option<String>>,
    last_error: Mutex<Option<String>>,
}

impl Outbox {
    pub fn open() -> Result<Self> {
        let path = db_path()?;
        let conn = Connection::open(&path).with_context(|| format!("open {:?}", path))?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS captures (
                id TEXT PRIMARY KEY,
                idem_key TEXT NOT NULL,
                client_id TEXT NOT NULL,
                body TEXT NOT NULL,
                captured_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS captures_attempts_idx ON captures(attempts);
            "#,
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
            last_attempt: Mutex::new(None),
            last_error: Mutex::new(None),
        })
    }

    /// Insert a serialized capture. `body` is the full JSON we'll POST.
    pub fn enqueue(&self, body_json: &str) -> Result<()> {
        // Parse just enough to grab idem_key/client_id/captured_at for the row.
        let parsed: serde_json::Value = serde_json::from_str(body_json)?;
        let idem_key = parsed
            .get("idem_key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("missing idem_key"))?;
        let client_id = parsed
            .get("client_id")
            .and_then(|v| v.as_str())
            .unwrap_or("helper-unknown");
        let captured_at = parsed
            .get("captured_at")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| Utc::now().to_rfc3339());

        // Internal row id; UUID is fine here, ULID would also work.
        let id = format!("ob_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));
        let conn = self.conn.lock().expect("outbox poisoned");
        conn.execute(
            "INSERT INTO captures (id, idem_key, client_id, body, captured_at, attempts)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![id, idem_key, client_id, body_json, captured_at],
        )?;
        Ok(())
    }

    pub fn pending_count(&self) -> Result<i64> {
        let conn = self.conn.lock().expect("outbox poisoned");
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM captures", [], |r| r.get(0))?;
        Ok(count)
    }

    pub fn next_batch(&self, limit: usize) -> Result<Vec<(String, String)>> {
        let conn = self.conn.lock().expect("outbox poisoned");
        let mut stmt =
            conn.prepare("SELECT id, body FROM captures ORDER BY captured_at ASC LIMIT ?1")?;
        let rows = stmt
            .query_map(params![limit as i64], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("outbox poisoned");
        conn.execute("DELETE FROM captures WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn bump_attempt(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("outbox poisoned");
        conn.execute(
            "UPDATE captures SET attempts = attempts + 1 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn record_attempt(&self, err: Option<String>) {
        *self.last_attempt.lock().expect("attempt poisoned") = Some(Utc::now().to_rfc3339());
        *self.last_error.lock().expect("error poisoned") = err;
    }

    pub fn stats(&self) -> OutboxStats {
        let pending = self.pending_count().unwrap_or(0);
        OutboxStats {
            pending,
            last_attempt_at: self
                .last_attempt
                .lock()
                .ok()
                .and_then(|g| g.clone()),
            last_error: self.last_error.lock().ok().and_then(|g| g.clone()),
        }
    }
}

// ============================================================================
// App state
// ============================================================================

pub struct AppState {
    pub config: Arc<Mutex<HelperConfig>>,
    pub outbox: Arc<Outbox>,
}

// ============================================================================
// Hotkey parsing
// ============================================================================

/// Parse a Tauri-style accelerator like "Alt+Space" or
/// "CommandOrControl+Shift+C" into a `Shortcut`. We accept the common aliases
/// the JS side uses; unknown tokens return an error so the Settings UI can
/// surface it.
fn parse_accelerator(s: &str) -> Result<Shortcut> {
    let mut mods = Modifiers::empty();
    let mut key: Option<Code> = None;
    for raw in s.split('+') {
        let tok = raw.trim();
        if tok.is_empty() {
            continue;
        }
        match tok.to_ascii_lowercase().as_str() {
            "cmd" | "command" | "super" | "meta" => mods |= Modifiers::SUPER,
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "alt" | "option" | "opt" => mods |= Modifiers::ALT,
            "shift" => mods |= Modifiers::SHIFT,
            "commandorcontrol" | "cmdorctrl" => {
                #[cfg(target_os = "macos")]
                {
                    mods |= Modifiers::SUPER;
                }
                #[cfg(not(target_os = "macos"))]
                {
                    mods |= Modifiers::CONTROL;
                }
            }
            other => {
                key = Some(parse_code(other).ok_or_else(|| anyhow!("unknown key {tok}"))?);
            }
        }
    }
    let key = key.ok_or_else(|| anyhow!("no key in accelerator {s}"))?;
    Ok(Shortcut::new(Some(mods), key))
}

fn parse_code(s: &str) -> Option<Code> {
    // Lowercase letters → KeyA..KeyZ ; digits → Digit0..Digit9 ; plus the
    // common named keys. Not exhaustive — sufficient for a hotkey rebind UI.
    if s.len() == 1 {
        let c = s.chars().next().unwrap();
        if c.is_ascii_alphabetic() {
            let up = c.to_ascii_uppercase();
            return match up {
                'A' => Some(Code::KeyA), 'B' => Some(Code::KeyB), 'C' => Some(Code::KeyC),
                'D' => Some(Code::KeyD), 'E' => Some(Code::KeyE), 'F' => Some(Code::KeyF),
                'G' => Some(Code::KeyG), 'H' => Some(Code::KeyH), 'I' => Some(Code::KeyI),
                'J' => Some(Code::KeyJ), 'K' => Some(Code::KeyK), 'L' => Some(Code::KeyL),
                'M' => Some(Code::KeyM), 'N' => Some(Code::KeyN), 'O' => Some(Code::KeyO),
                'P' => Some(Code::KeyP), 'Q' => Some(Code::KeyQ), 'R' => Some(Code::KeyR),
                'S' => Some(Code::KeyS), 'T' => Some(Code::KeyT), 'U' => Some(Code::KeyU),
                'V' => Some(Code::KeyV), 'W' => Some(Code::KeyW), 'X' => Some(Code::KeyX),
                'Y' => Some(Code::KeyY), 'Z' => Some(Code::KeyZ),
                _ => None,
            };
        }
        if c.is_ascii_digit() {
            return match c {
                '0' => Some(Code::Digit0), '1' => Some(Code::Digit1), '2' => Some(Code::Digit2),
                '3' => Some(Code::Digit3), '4' => Some(Code::Digit4), '5' => Some(Code::Digit5),
                '6' => Some(Code::Digit6), '7' => Some(Code::Digit7), '8' => Some(Code::Digit8),
                '9' => Some(Code::Digit9),
                _ => None,
            };
        }
    }
    match s.to_ascii_lowercase().as_str() {
        "space" => Some(Code::Space),
        "enter" | "return" => Some(Code::Enter),
        "tab" => Some(Code::Tab),
        "esc" | "escape" => Some(Code::Escape),
        "up" => Some(Code::ArrowUp),
        "down" => Some(Code::ArrowDown),
        "left" => Some(Code::ArrowLeft),
        "right" => Some(Code::ArrowRight),
        "backspace" => Some(Code::Backspace),
        "delete" => Some(Code::Delete),
        "home" => Some(Code::Home),
        "end" => Some(Code::End),
        "pageup" => Some(Code::PageUp),
        "pagedown" => Some(Code::PageDown),
        "f1" => Some(Code::F1), "f2" => Some(Code::F2), "f3" => Some(Code::F3),
        "f4" => Some(Code::F4), "f5" => Some(Code::F5), "f6" => Some(Code::F6),
        "f7" => Some(Code::F7), "f8" => Some(Code::F8), "f9" => Some(Code::F9),
        "f10" => Some(Code::F10), "f11" => Some(Code::F11), "f12" => Some(Code::F12),
        _ => None,
    }
}

// ============================================================================
// IPC commands
// ============================================================================

#[tauri::command]
fn cmd_load_config(state: tauri::State<'_, AppState>) -> HelperConfig {
    state.config.lock().expect("config poisoned").clone()
}

#[tauri::command]
fn cmd_save_config(
    state: tauri::State<'_, AppState>,
    cfg: HelperConfig,
) -> Result<(), String> {
    write_config_to_disk(&cfg).map_err(|e| e.to_string())?;
    *state.config.lock().expect("config poisoned") = cfg;
    Ok(())
}

#[tauri::command]
fn cmd_rebind_hotkey<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    accelerator: String,
) -> Result<(), String> {
    let new_shortcut = parse_accelerator(&accelerator).map_err(|e| e.to_string())?;
    let gs = app.global_shortcut();
    // Unregister whatever's currently bound first. We don't track the previous
    // accelerator separately — unregister_all is a cheap safety net here since
    // we only ever own a single shortcut.
    let _ = gs.unregister_all();
    // Re-attach the handler bound to the new accelerator. `on_shortcut`
    // registers and wires the callback in one call.
    let shortcut_for_check = new_shortcut.clone();
    gs.on_shortcut(new_shortcut, move |app, scut, event| {
        if scut == &shortcut_for_check && event.state() == ShortcutState::Pressed {
            let app_clone = app.clone();
            let _ = app.run_on_main_thread(move || {
                if let Err(e) = show_popover(&app_clone) {
                    log::error!("hotkey show_popover: {e}");
                }
            });
        }
    })
    .map_err(|e| format!("register failed: {e}"))?;
    let mut cfg = state.config.lock().expect("config poisoned");
    cfg.hotkey = accelerator;
    write_config_to_disk(&cfg).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn cmd_show_popover<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    show_popover(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_hide_popover<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("popover") {
        let _ = w.hide();
    }
    Ok(())
}

#[tauri::command]
fn cmd_show_settings<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    show_settings(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_open_url(url: String) -> Result<(), String> {
    // We don't include the opener plugin to keep the dep set small; on macOS
    // /usr/bin/open exists everywhere we care about.
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        // `start` is a cmd.exe builtin; empty first arg is the window title slot.
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = url; // suppress unused warning
        return Err("open_url not implemented on this platform yet".into());
    }
    Ok(())
}

#[tauri::command]
fn cmd_enqueue_capture(
    state: tauri::State<'_, AppState>,
    body: String,
) -> Result<(), String> {
    state.outbox.enqueue(&body).map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_outbox_stats(state: tauri::State<'_, AppState>) -> OutboxStats {
    state.outbox.stats()
}

#[tauri::command]
fn cmd_outbox_flush() -> Result<(), String> {
    // The replay thread already runs every 10s; the JS-side `flushNow` is
    // mostly an affordance for the Settings page to nudge it. We return Ok
    // and let the periodic drain pick up the work on its next tick.
    Ok(())
}

// ============================================================================
// Window helpers
// ============================================================================

/// Position the popover near the menubar. On macOS the tray icon is in the
/// status bar at the top of the *primary* monitor; we anchor near the top
/// center for simplicity. A future iteration could use TrayIconEvent's
/// `rect.position` to align under the actual tray click, but that's only
/// reported in tray events, not on hotkey invocations.
fn position_popover<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let win = app
        .get_webview_window("popover")
        .ok_or_else(|| anyhow!("popover window missing"))?;
    let monitor = win.primary_monitor()?.ok_or_else(|| anyhow!("no monitor"))?;
    let size = monitor.size();
    let scale = monitor.scale_factor();
    // Center horizontally, sit 32 logical px under the menubar.
    let popover_w = 480.0_f64;
    let logical_w = size.width as f64 / scale;
    let x = ((logical_w - popover_w) / 2.0).max(0.0);
    let y = 32.0_f64;
    win.set_position(LogicalPosition::new(x, y))?;
    win.set_size(LogicalSize::new(popover_w, 120.0))?;
    Ok(())
}

fn show_popover<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let win = match app.get_webview_window("popover") {
        Some(w) => w,
        None => create_popover_window(app)?,
    };
    position_popover(app)?;
    win.show()?;
    win.set_focus()?;
    // Tell the React side to clear any stale text and re-focus the input.
    let _ = app.emit_to("popover", "popover:reset", ());
    Ok(())
}

fn show_settings<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let win = match app.get_webview_window("settings") {
        Some(w) => w,
        None => create_settings_window(app)?,
    };
    win.show()?;
    win.set_focus()?;
    Ok(())
}

fn create_popover_window<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::WebviewWindow<R>> {
    let win = WebviewWindowBuilder::new(app, "popover", WebviewUrl::App("popover.html".into()))
        .title("Compass — Capture")
        .inner_size(480.0, 120.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(true)
        .build()?;
    // Auto-hide on focus loss — keeps the popover feeling like a Spotlight.
    let app_handle = app.clone();
    let win_for_listener = win.clone();
    win_for_listener.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            if let Some(w) = app_handle.get_webview_window("popover") {
                let _ = w.hide();
            }
        }
    });
    Ok(win)
}

fn create_settings_window<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::WebviewWindow<R>> {
    let win = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("Compass Helper — Settings")
        .inner_size(720.0, 640.0)
        .resizable(true)
        .visible(false)
        .build()?;
    Ok(win)
}

// ============================================================================
// Tray
// ============================================================================

fn build_tray<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let capture = MenuItem::with_id(app, "capture", "Capture…", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open_compass", "Open Compass", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&capture, &open, &settings, &quit])?;

    // A tiny PNG of a compass rose lives in icons/icon.png as a placeholder.
    // It's a template image so macOS tints it to match light/dark menubars.
    // Swap the PNG for your own assets before distributing — see README.
    let icon_bytes: &[u8] = include_bytes!("../icons/icon.png");
    let icon = Image::from_bytes(icon_bytes).map_err(|e| anyhow!("tray icon: {e}"))?;

    let mut builder = TrayIconBuilder::with_id("compass-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(handle_menu_event::<R>)
        .on_tray_icon_event(handle_tray_event::<R>);
    #[cfg(target_os = "macos")]
    {
        builder = builder.icon_as_template(true);
    }
    builder.build(app)?;
    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        "capture" => {
            if let Err(e) = show_popover(app) {
                log::error!("show_popover: {e}");
            }
        }
        "open_compass" => {
            let url = {
                let state: tauri::State<AppState> = app.state();
                state.config.lock().expect("config poisoned").base_url.clone()
            };
            #[cfg(target_os = "macos")]
            {
                let _ = std::process::Command::new("/usr/bin/open").arg(&url).spawn();
            }
            #[cfg(not(target_os = "macos"))]
            { let _ = url; }
        }
        "settings" => {
            if let Err(e) = show_settings(app) {
                log::error!("show_settings: {e}");
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

fn handle_tray_event<R: Runtime>(tray: &tauri::tray::TrayIcon<R>, event: TrayIconEvent) {
    // Left click = open popover anchored under the tray icon. The menu still
    // opens on right click via the macOS default behavior.
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        position,
        ..
    } = event
    {
        let app = tray.app_handle();
        if let Err(e) = show_popover(app) {
            log::error!("tray show_popover: {e}");
        }
        if let Some(win) = app.get_webview_window("popover") {
            // Snap below the tray icon when we have a real position.
            let _ = win.set_position(PhysicalPosition::new(
                position.x as i32,
                position.y as i32 + 8,
            ));
        }
    }
}

// ============================================================================
// Replay loop
// ============================================================================

async fn replay_loop(outbox: Arc<Outbox>, config: Arc<Mutex<HelperConfig>>) {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("reqwest client init: {e}");
            return;
        }
    };
    loop {
        tokio::time::sleep(Duration::from_secs(10)).await;
        let (base_url, token) = {
            let g = match config.lock() {
                Ok(g) => g,
                Err(_) => continue,
            };
            (g.base_url.clone(), g.token.clone())
        };
        if base_url.is_empty() || token.is_empty() {
            // Not configured yet; skip silently.
            continue;
        }
        let endpoint = format!("{}/api/v1/captures", base_url.trim_end_matches('/'));
        let batch = match outbox.next_batch(20) {
            Ok(b) => b,
            Err(e) => {
                log::warn!("outbox read: {e}");
                continue;
            }
        };
        if batch.is_empty() {
            continue;
        }
        for (row_id, body) in batch {
            let res = client
                .post(&endpoint)
                .bearer_auth(&token)
                .header("content-type", "application/json")
                .body(body)
                .send()
                .await;
            match res {
                Ok(r) => {
                    let status = r.status().as_u16();
                    if r.status().is_success() || status == 409 {
                        if let Err(e) = outbox.delete(&row_id) {
                            log::warn!("outbox delete {row_id}: {e}");
                        }
                        outbox.record_attempt(None);
                    } else if (400..500).contains(&status) {
                        // Permanent client error other than 409 — bump attempt
                        // count but keep the row so the user can investigate.
                        let _ = outbox.bump_attempt(&row_id);
                        outbox.record_attempt(Some(format!("HTTP {status}")));
                    } else {
                        let _ = outbox.bump_attempt(&row_id);
                        outbox.record_attempt(Some(format!("HTTP {status}")));
                    }
                }
                Err(e) => {
                    let _ = outbox.bump_attempt(&row_id);
                    outbox.record_attempt(Some(e.to_string()));
                    // Don't hammer the rest of the batch on a network failure.
                    break;
                }
            }
        }
    }
}

// ============================================================================
// run()
// ============================================================================

pub fn run() {
    env_logger::init();

    let initial_config = read_config_from_disk();
    let outbox = Arc::new(Outbox::open().unwrap_or_else(|e| {
        // If the outbox can't open we still want the app to launch — the user
        // can fix permissions from Settings, and synchronous captures still
        // work. We log and substitute an in-memory DB.
        log::error!("outbox open failed: {e}; using in-memory fallback");
        Outbox {
            conn: Mutex::new(Connection::open_in_memory().expect("memory db")),
            last_attempt: Mutex::new(None),
            last_error: Mutex::new(Some(format!("disk init failed: {e}"))),
        }
    }));
    // Ensure tables exist even on the fallback path.
    {
        let conn = outbox.conn.lock().expect("outbox poisoned");
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS captures (
                id TEXT PRIMARY KEY,
                idem_key TEXT NOT NULL,
                client_id TEXT NOT NULL,
                body TEXT NOT NULL,
                captured_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );",
        );
    }

    let shared_cfg = Arc::new(Mutex::new(initial_config.clone()));
    let state = AppState {
        config: shared_cfg.clone(),
        outbox: outbox.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None::<Vec<&str>>,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(state)
        .setup(move |app| {
            // macOS: never show a dock icon. Tauri 2 exposes this via the
            // ActivationPolicy enum off the AppHandle on macOS only.
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            build_tray(app.handle())?;

            // Register the configured global shortcut. We re-fetch from
            // initial_config (cheap clone) rather than reaching into state so
            // setup doesn't need to lock during init. The plugin's on_shortcut
            // callback runs in a background thread; we hop back to the main
            // thread via run_on_main_thread to manipulate windows.
            let accelerator = initial_config.hotkey.clone();
            let gs = app.global_shortcut();
            match parse_accelerator(&accelerator) {
                Ok(shortcut) => {
                    let shortcut_for_check = shortcut.clone();
                    if let Err(e) = gs.on_shortcut(shortcut.clone(), move |app, scut, event| {
                        if scut == &shortcut_for_check
                            && event.state() == ShortcutState::Pressed
                        {
                            let app_clone = app.clone();
                            let _ = app.run_on_main_thread(move || {
                                if let Err(e) = show_popover(&app_clone) {
                                    log::error!("hotkey show_popover: {e}");
                                }
                            });
                        }
                    }) {
                        log::error!("register hotkey {accelerator}: {e}");
                    }
                }
                Err(e) => log::error!("bad accelerator {accelerator}: {e}"),
            }

            // Pre-create both windows hidden so the first hotkey press is fast.
            if let Err(e) = create_popover_window(app.handle()) {
                log::error!("popover preload: {e}");
            }

            // Spawn the replay loop on Tauri's async runtime. The shared
            // Arc<Mutex> is the single source of truth — IPC commands mutate
            // it directly via AppState, so the loop sees changes immediately.
            let replay_cfg = shared_cfg.clone();
            let replay_outbox = outbox.clone();
            tauri::async_runtime::spawn(async move {
                replay_loop(replay_outbox, replay_cfg).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_load_config,
            cmd_save_config,
            cmd_rebind_hotkey,
            cmd_show_popover,
            cmd_hide_popover,
            cmd_show_settings,
            cmd_open_url,
            cmd_enqueue_capture,
            cmd_outbox_stats,
            cmd_outbox_flush,
        ])
        .build(tauri::generate_context!())
        .expect("error building Compass Helper")
        .run(|_app_handle, event| {
            // Prevent the default "last-window-closed = quit" behavior on
            // macOS so the tray stays alive when the user closes Settings.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
