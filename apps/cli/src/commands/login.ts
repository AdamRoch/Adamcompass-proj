// `compass login` — device-code flow.
//
//   1) POST /api/v1/auth/device                 → { device_code, user_code, verification_url, ... }
//   2) Print the user_code + URL; try to open the browser.
//   3) Poll /api/v1/auth/poll until approved/denied/expired.
//   4) Write ~/.compass/credentials.json (mode 0600).

import { spawn } from 'node:child_process';
import { hostname, platform } from 'node:os';
import { CompassApiError, CompassClient } from '@compass/api-client';
import kleur from 'kleur';
import { writeCredentials } from '../config.js';

export interface LoginOptions {
  baseUrl?: string;
  /** Poll interval in seconds. */
  interval?: number;
  /** Maximum number of polls. */
  maxAttempts?: number;
  /** When true, do not try to open a browser. */
  noBrowser?: boolean;
}

const DEFAULT_INTERVAL_S = 5;
const DEFAULT_MAX_ATTEMPTS = 60; // 5 minutes total at 5s

export async function runLogin(opts: LoginOptions): Promise<number> {
  const envBase = process.env.COMPASS_BASE_URL?.trim();
  const baseUrl = (opts.baseUrl ?? envBase ?? '').trim();
  if (!baseUrl) {
    console.error(kleur.red('error: ') + 'no base URL provided.');
    console.error(
      'Hint: ' +
        kleur.dim('compass login --base-url https://compass.example.com  OR  set COMPASS_BASE_URL'),
    );
    return 1;
  }

  const client = new CompassClient({ baseUrl });

  let device: Awaited<ReturnType<typeof client.startDeviceCode>>;
  try {
    device = await client.startDeviceCode('cli');
  } catch (err) {
    printLoginError('failed to start device-code flow', err);
    return 1;
  }

  console.log('');
  console.log(kleur.bold('Visit ') + kleur.cyan(device.verification_url));
  console.log(kleur.bold('Enter code: ') + kleur.yellow(device.user_code));
  console.log('');
  console.log(
    kleur.dim(
      `Waiting up to ${
        (opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) * (opts.interval ?? device.interval ?? DEFAULT_INTERVAL_S)
      }s for approval…`,
    ),
  );

  if (!opts.noBrowser) {
    tryOpenBrowser(device.verification_url);
  }

  const intervalMs = (opts.interval ?? device.interval ?? DEFAULT_INTERVAL_S) * 1000;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(intervalMs);
    try {
      const res = await client.pollDeviceCode(device.device_code);
      if (res.status === 'approved' && res.token) {
        await writeCredentials({
          base_url: baseUrl.replace(/\/$/, ''),
          token: res.token,
          last_contact_at: new Date().toISOString(),
          label: `cli on ${hostname()}`,
        });
        console.log('');
        console.log(kleur.green('logged in') + kleur.dim(` — credentials saved.`));
        return 0;
      }
      if (res.status === 'denied') {
        console.error(kleur.red('denied') + ' — login was rejected.');
        return 1;
      }
      // pending — keep polling.
    } catch (err) {
      // If the server responds 400/410 etc. mid-flow, treat as fatal.
      if (err instanceof CompassApiError && err.status >= 400 && err.status < 500) {
        printLoginError('polling failed', err);
        return 1;
      }
      // Transient — retry until budget exhausted.
    }
  }

  console.error(kleur.red('error: ') + 'login timed out before approval.');
  console.error(kleur.dim('Hint: re-run `compass login` to try again.'));
  return 1;
}

function tryOpenBrowser(url: string): void {
  const plat = platform();
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args = plat === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
    child.on('error', () => {
      // Silent — printing was enough; the user can copy-paste.
    });
  } catch {
    // Ignore.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printLoginError(prefix: string, err: unknown): void {
  if (err instanceof CompassApiError) {
    const body = err.body as { error?: { message?: string } } | null;
    const msg = body?.error?.message ?? `HTTP ${err.status}`;
    console.error(kleur.red('error: ') + `${prefix}: ${msg}`);
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(kleur.red('error: ') + `${prefix}: ${msg}`);
  }
}
