// `compass logout` — best-effort revoke + delete credentials.

import kleur from 'kleur';
import { deleteCredentials, readCredentials } from '../config.js';

export async function runLogout(): Promise<number> {
  const creds = await readCredentials();
  if (!creds) {
    console.log(kleur.dim('not logged in.'));
    return 0;
  }

  // Best-effort revoke. The endpoint is not in the typed SDK yet, so we POST directly
  // and tolerate any failure — local state is the source of truth for "am I logged in?".
  const revokeUrl = `${creds.base_url.replace(/\/$/, '')}/api/v1/auth/revoke`;
  try {
    await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Ignore — we still wipe local credentials.
  }

  await deleteCredentials();
  console.log(kleur.green('logged out') + kleur.dim(' — credentials deleted.'));
  return 0;
}
