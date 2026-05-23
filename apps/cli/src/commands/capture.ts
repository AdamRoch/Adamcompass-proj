// `compass capture` — enqueue a capture (and try to send it now).

import { CompassApiError, CompassClient } from '@compass/api-client';
import { INBOX_TYPE_HINTS, type InboxTypeHint } from '@compass/shared';
import kleur from 'kleur';
import { v4 as uuidv4 } from 'uuid';
import { deriveClientId, resolveConfig, updateLastContact } from '../config.js';
import { appendOutbox, type OutboxEntry, toCaptureRequest } from '../outbox.js';

export interface CaptureOptions {
  type?: string;
  tag?: string[];
  project?: string;
}

export interface CaptureContext {
  /** stdin reader injected for testability. */
  readStdin: () => Promise<string>;
}

export async function runCapture(
  positionalText: string | undefined,
  opts: CaptureOptions,
  ctx: CaptureContext,
): Promise<number> {
  const text = await resolveText(positionalText, ctx);
  if (!text) {
    console.error(kleur.red('error: ') + 'no capture text provided.');
    console.error('Hint: ' + kleur.dim('compass capture "your text"  OR  echo "..." | compass capture'));
    return 1;
  }

  const typeHint = normalizeType(opts.type);
  if (typeHint === null) {
    console.error(
      kleur.red('error: ') +
        `invalid --type "${opts.type ?? ''}". Allowed: ${INBOX_TYPE_HINTS.join(', ')}.`,
    );
    return 1;
  }

  const tags = (opts.tag ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
  if (opts.project) {
    // Optional convenience: warn if the project id doesn't look like a ULID — but don't block;
    // server is the authority. PRD §8.2 allows skipping inbox by filing directly.
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(opts.project)) {
      console.error(
        kleur.yellow('warn: ') +
          `--project "${opts.project}" doesn't look like a ULID; sending anyway.`,
      );
    }
  }

  const cfg = await resolveConfig({ requireToken: true });
  const client = new CompassClient({ baseUrl: cfg.baseUrl, token: cfg.token });

  // Note: the outbox is already replayed by the top-level preAction hook
  // (PRD §8.2 "On every invocation, the CLI first tries to replay…"). We do not
  // re-replay here to avoid double work.

  const entry: OutboxEntry = {
    idem_key: uuidv4(),
    client_id: deriveClientId(),
    body: text,
    type_hint: typeHint,
    tags,
    captured_at: new Date().toISOString(),
    enqueued_at: new Date().toISOString(),
  };

  // Try to send right away. If it fails, queue it. (Order matters: queue-on-failure means
  // the freshly typed capture survives a crash before we even try the network.)
  let sent = false;
  let createdNoteId: string | null = null;
  try {
    const res = await client.capture(toCaptureRequest(entry));
    sent = true;
    createdNoteId = res.note?.id ?? null;
    await updateLastContact(new Date().toISOString());
  } catch (err) {
    if (err instanceof CompassApiError && err.status === 409) {
      // Duplicate — server already has it. Treat as sent (but we don't get the note id back,
      // so we can't auto-file in this case).
      sent = true;
      await updateLastContact(new Date().toISOString());
    } else {
      await appendOutbox(entry);
      printSendFailure(err);
    }
  }

  // If --project supplied AND we got back a fresh note, file it immediately. This is a
  // convenience layer on top of the standard capture flow: any failure here is non-fatal —
  // the capture itself is safe in the inbox.
  let filed = false;
  if (sent && createdNoteId && opts.project) {
    try {
      await client.fileFromInbox(createdNoteId, {
        target: 'existing',
        target_type: 'project',
        target_id: opts.project,
      });
      filed = true;
      await updateLastContact(new Date().toISOString());
    } catch (err) {
      console.error(
        kleur.yellow('warn: ') +
          'capture succeeded but filing into project failed: ' +
          describeErr(err),
      );
      console.error(kleur.dim('  The note is in your inbox; file it manually.'));
    }
  }

  if (sent) {
    const suffix = filed
      ? kleur.dim(` (${typeHint}, filed)`)
      : kleur.dim(` (${typeHint})`);
    console.log(kleur.green('captured') + suffix);
  } else {
    console.log(
      kleur.yellow('queued') +
        kleur.dim(` (${typeHint}) — will retry on the next \`compass\` invocation`),
    );
  }
  return 0;
}

function describeErr(err: unknown): string {
  if (err instanceof CompassApiError) {
    const body = err.body as { error?: { message?: string } } | null;
    return body?.error?.message ?? `HTTP ${err.status}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function normalizeType(raw: string | undefined): InboxTypeHint | null {
  if (!raw) return 'unspecified';
  const lower = raw.toLowerCase();
  return (INBOX_TYPE_HINTS as readonly string[]).includes(lower) ? (lower as InboxTypeHint) : null;
}

async function resolveText(
  positional: string | undefined,
  ctx: CaptureContext,
): Promise<string> {
  if (typeof positional === 'string' && positional.trim().length > 0) {
    return positional.trim();
  }
  // No positional arg — read stdin if it's piped.
  if (!process.stdin.isTTY) {
    const stdin = await ctx.readStdin();
    return stdin.trim();
  }
  return '';
}

function printSendFailure(err: unknown): void {
  if (err instanceof CompassApiError) {
    const body = err.body as { error?: { code?: string; message?: string } } | null;
    const msg = body?.error?.message ?? `HTTP ${err.status}`;
    console.error(kleur.yellow('send failed: ') + msg + kleur.dim(' (queued for retry)'));
    if (err.status === 401 || err.status === 403) {
      console.error(kleur.dim('  Hint: run `compass login` to refresh your token.'));
    }
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(kleur.yellow('send failed: ') + msg + kleur.dim(' (queued for retry)'));
  }
}

/** Read all of stdin as a UTF-8 string. */
export async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
