import { redirect } from 'next/navigation';
import { currentUser, ensureSingleUserExists, setSession, verifyPassword } from '@/lib/auth';
import * as authQ from '@compass/db/queries/auth';

function bootstrapAllowed(): boolean {
  return process.env.COMPASS_BOOTSTRAP_ALLOW_FIRST_USER === '1';
}

async function loginAction(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return;
  }

  // Bootstrap: if no users exist yet, create the first user using the form credentials.
  // Gated behind COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=1 so a fresh install is not silently
  // claimable by the first HTTP visitor.
  const existingAny = await authQ.getSingleUser();
  if (!existingAny) {
    if (!bootstrapAllowed()) {
      redirect('/login?error=bootstrap_disabled');
    }
    const user = await ensureSingleUserExists(email, password);
    await setSession(user.id);
    await authQ.recordLogin(user.id);
    redirect('/');
  }

  const user = await authQ.getUserByEmail(email);
  if (!user) {
    redirect('/login?error=invalid');
  }
  const ok = await verifyPassword(password, user!.password_hash);
  if (!ok) {
    redirect('/login?error=invalid');
  }
  await setSession(user!.id);
  await authQ.recordLogin(user!.id);
  redirect('/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await currentUser();
  if (me) redirect('/');
  const sp = await searchParams;
  const error = sp.error;
  const noUserYet = (await authQ.getSingleUser()) == null;
  const canBootstrap = bootstrapAllowed();

  return (
    <div className="surface-glass p-8">
      <h1 className="text-2xl font-display font-medium mb-1">Compass</h1>
      <p className="text-text-muted text-sm mb-6">Sign in to your dashboard.</p>
      <form action={loginAction} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border bg-surface px-3 py-2 text-sm focus-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border bg-surface px-3 py-2 text-sm focus-ring"
          />
        </div>
        {error === 'invalid' && (
          <p className="text-sm text-danger">Wrong email or password.</p>
        )}
        {(error === 'bootstrap_disabled' || (noUserYet && !canBootstrap)) && (
          <p className="text-sm text-danger">
            No account exists yet. Set <code>COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=1</code> in
            the server environment and reload this page to create the first user.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover focus-ring"
        >
          Sign in
        </button>
        {noUserYet && canBootstrap && (
          <p className="text-xs text-text-subtle text-center">
            First time? Use this form to create your account.
          </p>
        )}
      </form>
    </div>
  );
}
