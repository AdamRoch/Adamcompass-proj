// Helper-side config object, read + persisted via Rust commands.
// Mirrors the JSON written to ~/Library/Application Support/compass-helper/config.json.

import { invoke } from '@tauri-apps/api/core';

export interface HelperConfig {
  base_url: string;
  token: string;
  hotkey: string;
  client_id: string;
  autostart: boolean;
}

export const DEFAULT_CONFIG: HelperConfig = {
  base_url: 'http://localhost:3000',
  token: '',
  hotkey: 'Alt+Space',
  client_id: 'helper-unknown',
  autostart: true,
};

export async function loadConfig(): Promise<HelperConfig> {
  try {
    const cfg = await invoke<HelperConfig>('cmd_load_config');
    return { ...DEFAULT_CONFIG, ...cfg };
  } catch (err) {
    console.error('loadConfig failed', err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(cfg: HelperConfig): Promise<void> {
  await invoke('cmd_save_config', { cfg });
}

export async function rebindHotkey(next: string): Promise<void> {
  // Backend unregisters the previous accelerator and registers `next`. If
  // registration fails (e.g., the system already owns that combo), the
  // backend throws and we propagate.
  await invoke('cmd_rebind_hotkey', { accelerator: next });
}
