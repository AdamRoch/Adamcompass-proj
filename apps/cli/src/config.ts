// Credentials + base URL config for the Compass CLI.
// Credentials file lives at ~/.compass/credentials.json, mode 0600.

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { homedir, hostname, userInfo } from 'node:os';
import { join } from 'node:path';

export interface Credentials {
  base_url: string;
  token: string;
  /** ISO timestamp of last successful server contact (any 2xx/409 response). */
  last_contact_at?: string;
  /** Optional friendly label for the token (e.g. "cli on adam-laptop"). */
  label?: string;
}

export const CONFIG_DIR = join(homedir(), '.compass');
export const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json');
export const OUTBOX_PATH = join(CONFIG_DIR, 'outbox.ndjson');

/** Stable client_id used as part of the capture idempotency key namespace. */
export function deriveClientId(): string {
  const host = safeSlug(hostname());
  const user = safeSlug(userInfo().username);
  return `cli-${host}-${user}`;
}

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export async function readCredentials(): Promise<Credentials | null> {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isCredentials(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCredentials(creds: Credentials): Promise<void> {
  await ensureConfigDir();
  const tmp = `${CREDENTIALS_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  // Belt and suspenders — chmod on rename target if it already existed with looser perms.
  await fs.rename(tmp, CREDENTIALS_PATH);
  await fs.chmod(CREDENTIALS_PATH, 0o600);
}

export async function deleteCredentials(): Promise<boolean> {
  if (!existsSync(CREDENTIALS_PATH)) return false;
  await fs.unlink(CREDENTIALS_PATH);
  return true;
}

export async function updateLastContact(now: string): Promise<void> {
  const creds = await readCredentials();
  if (!creds) return;
  creds.last_contact_at = now;
  await writeCredentials(creds);
}

export interface ResolvedConfig {
  baseUrl: string;
  token: string | undefined;
  /** True if base URL came from env, false if from credentials file. */
  baseUrlFromEnv: boolean;
}

/**
 * Resolve base URL + token from env then credentials. Throws a friendly error if base URL
 * cannot be determined. Token may be absent (login command still needs to run).
 */
export async function resolveConfig(opts: { requireToken: boolean }): Promise<ResolvedConfig> {
  const envBase = process.env.COMPASS_BASE_URL?.trim();
  const creds = await readCredentials();

  const baseUrl = envBase && envBase.length > 0 ? envBase : creds?.base_url;
  if (!baseUrl) {
    throw new ConfigError(
      'No Compass base URL configured.',
      'Set COMPASS_BASE_URL=https://compass.example.com or run `compass login` first.',
    );
  }

  const token = creds?.token;
  if (opts.requireToken && !token) {
    throw new ConfigError(
      'You are not logged in.',
      'Run `compass login` to authenticate this terminal.',
    );
  }

  return { baseUrl: stripTrailingSlash(baseUrl), token, baseUrlFromEnv: Boolean(envBase) };
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

export class ConfigError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'ConfigError';
    this.hint = hint;
  }
}

function isCredentials(v: unknown): v is Credentials {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.base_url === 'string' && typeof o.token === 'string';
}

/** Re-export for tests / debug. */
export function _credentialsDir(): string {
  return CONFIG_DIR;
}
