import {
  currentUser,
  hashToken,
  issueCsrfToken,
  newRandomToken,
  verifyCsrfToken,
} from '@/lib/auth';
import * as authQ from '@compass/db/queries/auth';
import { redirect } from 'next/navigation';

async function approveAction(formData: FormData) {
  'use server';
  const user_code = String(formData.get('user_code') ?? '');
  const csrf = formData.get('csrf');
  const me = await currentUser();
  if (!me) redirect(`/login?next=/auth/device?code=${user_code}`);
  if (!verifyCsrfToken(typeof csrf === 'string' ? csrf : null, me?.id)) {
    redirect(`/auth/device?code=${user_code}&error=csrf`);
  }
  const dc = await authQ.getDeviceCodeByUserCode(user_code);
  if (!dc) redirect(`/auth/device?code=${user_code}&error=expired`);
  // Mint a token, save its hash to auth_token, and stash the *plain* in
  // device_code.pending_plain_token for one-time pickup by the polling client.
  const plain = newRandomToken(dc.scope === 'cli' ? 'cpsc' : 'cpsh');
  const created = await authQ.createToken({
    name: `${dc.scope} via device-code`,
    scope: dc.scope,
    token_hash: hashToken(plain),
  });
  await authQ.approveDeviceCode(dc.device_code, {
    token_id: created.id,
    pending_plain_token: plain,
  });
  redirect(`/auth/device?code=${user_code}&approved=1&name=${encodeURIComponent(created.name)}`);
}

async function denyAction(formData: FormData) {
  'use server';
  const user_code = String(formData.get('user_code') ?? '');
  const csrf = formData.get('csrf');
  const me = await currentUser();
  if (!me) redirect(`/login?next=/auth/device?code=${user_code}`);
  if (!verifyCsrfToken(typeof csrf === 'string' ? csrf : null, me?.id)) {
    redirect(`/auth/device?code=${user_code}&error=csrf`);
  }
  const dc = await authQ.getDeviceCodeByUserCode(user_code);
  if (dc) await authQ.denyDeviceCode(dc.device_code);
  redirect(`/auth/device?code=${user_code}&denied=1`);
}

export default async function DeviceApprovePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const code = sp.code ?? '';
  const approved = sp.approved === '1';
  const denied = sp.denied === '1';
  const error = sp.error;
  const me = await currentUser();
  if (!me) redirect('/login');
  const csrf = issueCsrfToken(me?.id);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="surface-glass p-8 w-full max-w-md">
        <h1 className="text-xl font-display font-medium mb-1">Approve a device</h1>
        <p className="text-sm text-text-muted mb-6">
          Confirm the code displayed by your CLI or helper to grant it access.
        </p>
        {approved && (
          <p className="rounded-md bg-success/15 text-success px-3 py-2 text-sm mb-4">
            Approved. The device should pick up its token shortly.
          </p>
        )}
        {denied && (
          <p className="rounded-md bg-danger/15 text-danger px-3 py-2 text-sm mb-4">
            Denied. The device will not gain access.
          </p>
        )}
        {error === 'expired' && (
          <p className="rounded-md bg-warning/15 text-warning px-3 py-2 text-sm mb-4">
            That code is invalid or expired.
          </p>
        )}
        {error === 'csrf' && (
          <p className="rounded-md bg-danger/15 text-danger px-3 py-2 text-sm mb-4">
            Form expired or could not be verified. Please retry.
          </p>
        )}
        {!approved && !denied && code ? (
          <>
            <div className="mb-6">
              <div className="text-xs text-text-muted">Device code</div>
              <div className="text-2xl font-mono tracking-widest">{code}</div>
            </div>
            <div className="flex gap-2">
              <form action={approveAction} className="flex-1">
                <input type="hidden" name="user_code" value={code} />
                <input type="hidden" name="csrf" value={csrf} />
                <button
                  type="submit"
                  className="w-full rounded-md bg-accent text-accent-fg py-2 text-sm font-medium hover:bg-accent-hover focus-ring"
                >
                  Approve
                </button>
              </form>
              <form action={denyAction} className="flex-1">
                <input type="hidden" name="user_code" value={code} />
                <input type="hidden" name="csrf" value={csrf} />
                <button
                  type="submit"
                  className="w-full rounded-md border bg-surface py-2 text-sm focus-ring"
                >
                  Deny
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={approveAction} className="space-y-3">
            <input type="hidden" name="csrf" value={csrf} />
            <label className="block text-sm text-text-muted">
              Enter the code from your device
              <input
                name="user_code"
                required
                pattern="[A-Z0-9-]+"
                className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm uppercase tracking-widest focus-ring"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-accent text-accent-fg py-2 text-sm font-medium hover:bg-accent-hover focus-ring"
            >
              Approve
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
