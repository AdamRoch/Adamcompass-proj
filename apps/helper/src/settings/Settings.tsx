import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  isEnabled as autostartIsEnabled,
  enable as autostartEnable,
  disable as autostartDisable,
} from '@tauri-apps/plugin-autostart';
import { CompassClient, CompassApiError } from '@compass/api-client';
import {
  DEFAULT_CONFIG,
  loadConfig,
  rebindHotkey,
  saveConfig,
  type HelperConfig,
} from '../lib/config.js';
import { getOutboxStats, type OutboxStats } from '../lib/outbox.js';

type Save = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

export function Settings() {
  const [cfg, setCfg] = useState<HelperConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<Save>({ kind: 'idle' });
  const [stats, setStats] = useState<OutboxStats | null>(null);
  const [pingState, setPingState] = useState<
    { kind: 'idle' } | { kind: 'ok'; ms: number } | { kind: 'err'; msg: string }
  >({ kind: 'idle' });
  const [hotkeyDraft, setHotkeyDraft] = useState('Alt+Space');
  const [hotkeyErr, setHotkeyErr] = useState<string | null>(null);

  useEffect(() => {
    loadConfig().then((c) => {
      setCfg(c);
      setHotkeyDraft(c.hotkey);
      setLoaded(true);
    });
    // Reflect current OS-level autostart status, which can drift from the
    // value in config.json if the user toggled it elsewhere.
    autostartIsEnabled()
      .then((enabled) => setCfg((c) => ({ ...c, autostart: enabled })))
      .catch(() => {});
    refreshStats();
    const t = setInterval(refreshStats, 5000);
    return () => clearInterval(t);
  }, []);

  function refreshStats() {
    getOutboxStats()
      .then(setStats)
      .catch(() => setStats(null));
  }

  const onSave = useCallback(async () => {
    try {
      await saveConfig(cfg);
      // Mirror autostart preference into the OS launch agent.
      try {
        if (cfg.autostart) await autostartEnable();
        else await autostartDisable();
      } catch (e) {
        console.warn('autostart toggle failed', e);
      }
      setSave({ kind: 'saved' });
      setTimeout(() => setSave({ kind: 'idle' }), 1500);
    } catch (e) {
      setSave({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [cfg]);

  const onPing = useCallback(async () => {
    setPingState({ kind: 'idle' });
    const client = new CompassClient({ baseUrl: cfg.base_url, token: cfg.token });
    const t0 = performance.now();
    try {
      // /api/v1/settings is auth-required and cheap — a clean round-trip
      // proof the token + base URL actually work.
      await client.getSettings();
      setPingState({ kind: 'ok', ms: Math.round(performance.now() - t0) });
    } catch (e) {
      const msg =
        e instanceof CompassApiError
          ? `HTTP ${e.status}`
          : e instanceof Error
            ? e.message
            : String(e);
      setPingState({ kind: 'err', msg });
    }
  }, [cfg.base_url, cfg.token]);

  const onRebind = useCallback(async () => {
    setHotkeyErr(null);
    const next = hotkeyDraft.trim();
    if (!next) {
      setHotkeyErr('hotkey cannot be empty');
      return;
    }
    try {
      await rebindHotkey(next);
      setCfg((c) => ({ ...c, hotkey: next }));
      // Persist so the next launch uses the new combo.
      await saveConfig({ ...cfg, hotkey: next });
    } catch (e) {
      setHotkeyErr(e instanceof Error ? e.message : String(e));
    }
  }, [hotkeyDraft, cfg]);

  const onOpenWebApp = useCallback(() => {
    invoke('cmd_open_url', { url: cfg.base_url }).catch((e) => console.error(e));
  }, [cfg.base_url]);

  if (!loaded) {
    return (
      <div className="settings-shell">
        <p>loading…</p>
      </div>
    );
  }

  return (
    <div className="settings-shell">
      <h1>Compass Helper</h1>

      <h2>Server</h2>
      <label>
        Base URL
        <input
          type="url"
          value={cfg.base_url}
          onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })}
          placeholder="https://compass.example.com"
        />
      </label>
      <label>
        Bearer token (helper scope)
        <input
          type="password"
          value={cfg.token}
          onChange={(e) => setCfg({ ...cfg, token: e.target.value })}
          placeholder="paste from Settings → Tokens"
        />
        <span className="helper-text">
          Create one in the web app at <code>/settings/tokens</code> with the
          <strong> helper</strong> scope.
        </span>
      </label>
      <div className="row">
        <button type="button" className="btn" onClick={onPing}>
          Test connection
        </button>
        {pingState.kind === 'ok' && (
          <span className="ok">connected — {pingState.ms}ms</span>
        )}
        {pingState.kind === 'err' && (
          <span className="err">failed: {pingState.msg}</span>
        )}
      </div>

      <h2>Hotkey</h2>
      <label>
        Global accelerator
        <input
          type="text"
          value={hotkeyDraft}
          onChange={(e) => setHotkeyDraft(e.target.value)}
          placeholder="Alt+Space"
        />
        <span className="helper-text">
          Tauri shortcut syntax. Examples: <code>Alt+Space</code>,
          <code> CommandOrControl+Shift+C</code>, <code>Super+J</code>.
        </span>
      </label>
      <div className="row">
        <button type="button" className="btn" onClick={onRebind}>
          Rebind
        </button>
        <span className="helper-text">currently: {cfg.hotkey}</span>
        {hotkeyErr && <span className="err">{hotkeyErr}</span>}
      </div>

      <h2>Client identity</h2>
      <label>
        Client ID (sent with every capture)
        <input
          type="text"
          value={cfg.client_id}
          onChange={(e) => setCfg({ ...cfg, client_id: e.target.value })}
          placeholder="helper-adam-laptop"
        />
      </label>

      <h2>Launch</h2>
      <label className="row">
        <input
          type="checkbox"
          checked={cfg.autostart}
          onChange={(e) => setCfg({ ...cfg, autostart: e.target.checked })}
        />
        <span>Open Compass Helper at login</span>
      </label>

      <h2>Outbox</h2>
      {stats ? (
        <div>
          <p>Pending: <strong>{stats.pending}</strong></p>
          {stats.last_attempt_at && (
            <p className="helper-text">last attempt: {stats.last_attempt_at}</p>
          )}
          {stats.last_error && (
            <p className="err">last error: {stats.last_error}</p>
          )}
        </div>
      ) : (
        <p className="helper-text">no stats yet</p>
      )}

      <h2>Web app</h2>
      <div className="row">
        <button type="button" className="btn" onClick={onOpenWebApp}>
          Open Compass web app
        </button>
        <span className="helper-text">
          Theme preview lives there under <code>/settings/themes</code>.
        </span>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={onSave}>
          Save
        </button>
        {save.kind === 'saved' && <span className="ok">saved</span>}
        {save.kind === 'error' && <span className="err">{save.message}</span>}
      </div>
    </div>
  );
}
