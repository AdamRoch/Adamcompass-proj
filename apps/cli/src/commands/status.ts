// `compass status` — show configured base URL, login state, outbox queue length,
// last server contact, and dialect (from /api/v1/health if available).

import kleur from 'kleur';
import { readCredentials } from '../config.js';
import { outboxLength } from '../outbox.js';

export async function runStatus(): Promise<number> {
  const envBase = process.env.COMPASS_BASE_URL?.trim();
  const creds = await readCredentials();

  const baseUrl = (envBase && envBase.length > 0 ? envBase : creds?.base_url) ?? null;
  const baseUrlSource = envBase ? 'env' : creds?.base_url ? 'credentials' : 'none';
  const loggedIn = Boolean(creds?.token);
  const queueLen = await outboxLength();
  const lastContact = creds?.last_contact_at ?? null;
  const dialect = baseUrl ? await fetchDialect(baseUrl) : null;

  console.log(kleur.bold('Compass CLI status'));
  printRow('base_url', baseUrl ? `${baseUrl} ${kleur.dim('(' + baseUrlSource + ')')}` : kleur.dim('(unset)'));
  printRow('login', loggedIn ? kleur.green('yes') : kleur.yellow('no'));
  printRow('outbox', queueLen === 0 ? kleur.green('empty') : kleur.yellow(`${queueLen} queued`));
  printRow('last_contact', lastContact ?? kleur.dim('never'));
  printRow('dialect', dialect ?? kleur.dim('n/a'));

  if (!baseUrl) {
    console.log('');
    console.log(
      kleur.dim('Hint: set COMPASS_BASE_URL or run `compass login --base-url <url>`.'),
    );
  } else if (!loggedIn) {
    console.log('');
    console.log(kleur.dim('Hint: run `compass login` to authenticate.'));
  }
  return 0;
}

async function fetchDialect(baseUrl: string): Promise<string | null> {
  const url = baseUrl.replace(/\/$/, '') + '/api/v1/health';
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { dialect?: string };
    return typeof body?.dialect === 'string' ? body.dialect : null;
  } catch {
    return null;
  }
}

function printRow(label: string, value: string): void {
  console.log('  ' + kleur.dim(label.padEnd(14)) + value);
}
