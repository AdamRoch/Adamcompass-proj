import { createHmac, timingSafeEqual } from 'node:crypto';
import { rateLimit } from '@/lib/api';
import { authenticateBearer } from '@/lib/auth';
import { getDb } from '@compass/db';
import * as adminQ from '@compass/db/queries/admin';
import * as buildRunsQ from '@compass/db/queries/build_runs';
import * as projectsQ from '@compass/db/queries/projects';
import * as webhookQ from '@compass/db/queries/webhook';
import { escapeMarkdownV2, escapeMarkdownV2Url, notify } from '@compass/notifications';
import { isUlid, newUlid, nowIso } from '@compass/shared';
import { webhookRunEventSchema } from '@compass/shared/zod';
import { type NextRequest, NextResponse } from 'next/server';

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function getSecret(): string {
  const s = process.env.COMPASS_WEBHOOK_HMAC_SECRET;
  if (!s || s.length < 16) {
    throw new Error('COMPASS_WEBHOOK_HMAC_SECRET must be at least 16 chars');
  }
  return s;
}

function verifySignature(rawBody: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const provided = headerSig.startsWith('sha256=') ? headerSig.slice(7) : headerSig;
  const expected = createHmac('sha256', getSecret()).update(rawBody).digest('hex');
  // Hashes are hex strings → decode to raw bytes before constant-time compare. Decoding as
  // 'utf8' worked accidentally (every char was ASCII), but 'hex' is the correct intent and
  // halves the byte length the comparator scans. Buffer.from with 'hex' silently truncates on
  // bad input, so we additionally require the decoded length to match the expected 32 bytes.
  const a = Buffer.from(provided, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function headerMap(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    // Redact secrets when persisting
    if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'x-compass-signature') {
      out[k] = '[redacted]';
    } else {
      out[k] = v;
    }
  });
  return out;
}

export async function POST(req: NextRequest) {
  const endpoint = '/webhooks/v1/runs/events';
  const ip = clientIp(req);
  const rawBody = await req.text();

  // Auth: bearer token (scope=webhook) + HMAC signature
  const bearer = await authenticateBearer(req.headers.get('authorization'), 'webhook').catch(
    () => null,
  );
  if (!bearer) {
    // Per-IP rate limit on the rejection path so an attacker can't fill
    // webhook_deliveries with junk rejects.
    if (!rateLimit(`webhook_reject:${ip}`, 30)) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'too many rejected webhook requests' } },
        { status: 429 },
      );
    }
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'rejected_auth',
    });
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'bearer token required' } },
      { status: 401 },
    );
  }

  const signature = req.headers.get('x-compass-signature');
  if (!verifySignature(rawBody, signature)) {
    if (!rateLimit(`webhook_reject:${ip}`, 30)) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'too many rejected webhook requests' } },
        { status: 429 },
      );
    }
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'rejected_signature',
    });
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'invalid signature' } },
      { status: 403 },
    );
  }

  let parsed: ReturnType<typeof webhookRunEventSchema.safeParse>;
  try {
    const body = JSON.parse(rawBody);
    parsed = webhookRunEventSchema.safeParse(body);
  } catch {
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'internal_error',
      error: 'invalid JSON',
    });
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'invalid JSON body' } },
      { status: 422 },
    );
  }

  if (!parsed.success) {
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'internal_error',
      error: 'schema validation failed',
    });
    return NextResponse.json(
      {
        error: {
          code: 'validation_failed',
          message: 'invalid payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }
  const ev = parsed.data;

  // Verify project exists — project_slug carries either a ULID (v1) or a human slug (V2).
  const project = isUlid(ev.project_slug)
    ? await projectsQ.getProject(ev.project_slug)
    : await projectsQ.getProjectBySlug(ev.project_slug);
  if (!project) {
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'internal_error',
      dedup_key: `${ev.run_id}:${ev.event_seq}`,
      error: 'unknown project_slug',
    });
    return NextResponse.json(
      { error: { code: 'not_found', message: 'unknown project_slug' } },
      { status: 404 },
    );
  }

  // Idempotency on (run_id, event_seq): claim the dedup row FIRST. If duplicate, short-circuit
  // before writing any state — protects against double-write on retries (PRD §7.4).
  const handle = getDb();
  const activity_event_id = newUlid();
  const dedupKey = `${ev.run_id}:${ev.event_seq}`;
  const dedup = await buildRunsQ.checkAndRecordDedup(ev.run_id, ev.event_seq, activity_event_id);
  if (dedup.duplicate) {
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'duplicate',
      dedup_key: dedupKey,
    });
    return NextResponse.json(
      { error: { code: 'duplicate', message: 'event already accepted' } },
      { status: 409 },
    );
  }

  try {
    await handle.db.insert(handle.schema.activity_event).values({
      id: activity_event_id,
      entity_type: 'build_run',
      entity_id: ev.run_id,
      event_type: 'run_event',
      payload_json: JSON.stringify(ev),
      occurred_at: ev.occurred_at,
      received_at: nowIso(),
    });
  } catch (e) {
    await webhookQ.record({
      endpoint,
      headers: headerMap(req),
      body_text: rawBody,
      status: 'internal_error',
      dedup_key: dedupKey,
      error: String(e),
    });
    throw e;
  }

  // Upsert the build_run from the event
  const { row: run } = await buildRunsQ.upsertFromEvent({
    run_id: ev.run_id,
    project_id: project.id,
    event_type: ev.event_type,
    occurred_at: ev.occurred_at,
    result: ev.payload.result,
    body_markdown: ev.payload.body_markdown,
    links: ev.payload.links,
    duration_ms: ev.payload.duration_ms,
    objective: ev.payload.objective,
  });

  // Fire build_run_event notification on terminal events
  if (ev.event_type === 'completed' || ev.event_type === 'failed') {
    // Build MarkdownV2-safe body. We escape user-provided fields (project title, link labels,
    // body_markdown). body_markdown is technically also user-authored Markdown but Telegram
    // MarkdownV2 is strict; escaping is safer than trying to detect/preserve a foreign dialect.
    const linksText = (ev.payload.links ?? [])
      .map((l) => `[${escapeMarkdownV2(l.label ?? l.kind)}](${escapeMarkdownV2Url(l.url)})`)
      .join(' · ');
    const verb = ev.event_type === 'completed' ? 'completed' : 'failed';
    const subject = `Run ${verb}: ${project.title}`;
    const escapedBody = ev.payload.body_markdown ? escapeMarkdownV2(ev.payload.body_markdown) : '';
    const bodyParts = [
      `*${escapeMarkdownV2(verb)}*`,
      escapedBody,
      linksText,
      ev.payload.duration_ms ? `Duration: ${Math.round(ev.payload.duration_ms / 1000)}s` : '',
    ].filter(Boolean);
    await notify({
      kind: 'build_run_event',
      subject,
      body_markdown: bodyParts.join('\n\n'),
      ref: { entity_type: 'project', entity_id: project.id },
    });
  }

  await adminQ.writeAudit({
    actor: 'webhook',
    action: 'webhook.run_event',
    entity_type: 'build_run',
    entity_id: ev.run_id,
    metadata: { event_type: ev.event_type, event_seq: ev.event_seq, project_id: project.id },
  });

  await webhookQ.record({
    endpoint,
    headers: headerMap(req),
    body_text: rawBody,
    status: 'accepted',
    dedup_key: dedupKey,
  });

  return NextResponse.json({ accepted: true, activity_event_id, run }, { status: 200 });
}
