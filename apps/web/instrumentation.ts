// Next.js server-side bootstrap hook. Runs once at server start in the Node runtime.
// Used to start the in-process scheduler (daily digest + stall sweeper) and ensure the
// single user is bootstrapped if env vars provide credentials.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  validateEnv();
  const { startScheduler } = await import('@compass/scheduler');
  await startScheduler();
  console.log('[compass] scheduler started');
}

/**
 * Fail-fast at boot if required secrets/config are missing. Catches deploys where
 * a secret was rotated out but not back in before the container restarted.
 */
function validateEnv() {
  const errors: string[] = [];

  const sessionSecret = process.env.COMPASS_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 16) {
    errors.push('COMPASS_SESSION_SECRET must be at least 16 chars');
  }

  const webhookSecret = process.env.COMPASS_WEBHOOK_HMAC_SECRET;
  if (!webhookSecret || webhookSecret.length < 16) {
    errors.push('COMPASS_WEBHOOK_HMAC_SECRET must be at least 16 chars');
  }

  // COMPASS_TOKEN_PEPPER strengthens bearer-token hashes. Required so we never silently
  // fall back to un-peppered hashes after a deploy where it was forgotten.
  const pepper = process.env.COMPASS_TOKEN_PEPPER;
  if (!pepper || pepper.length < 16) {
    errors.push('COMPASS_TOKEN_PEPPER must be at least 16 chars');
  }

  // Telegram is optional — but if one var is set, both should be.
  const hasBot = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasChat = !!process.env.TELEGRAM_CHAT_ID;
  if (hasBot !== hasChat) {
    errors.push(
      'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set together (or both unset)',
    );
  }

  if (errors.length > 0) {
    const msg = `[compass] missing/invalid env vars:\n  - ${errors.join('\n  - ')}`;
    console.error(msg);
    throw new Error(msg);
  }
}
