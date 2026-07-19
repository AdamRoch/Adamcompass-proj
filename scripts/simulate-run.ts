#!/usr/bin/env node --import tsx
// Simulates an external agentic build run reporting into Compass via the webhook,
// standing in for the real agent until one is connected (V2 PRD §3.6).
//
// Usage:
//   COMPASS_BASE_URL=http://localhost:3000 \
//   COMPASS_WEBHOOK_TOKEN=<bearer with scope=webhook> \
//   COMPASS_WEBHOOK_HMAC_SECRET=<same secret as the server> \
//   pnpm tsx scripts/simulate-run.ts <project-slug-or-ulid> ["objective text"]
//
// Mint a webhook token from Settings → Tokens, or:
//   curl -X POST $BASE/api/v1/admin/tokens -H 'cookie: …' -d '{"scope":"webhook","name":"sim"}'

import { createHmac, randomBytes } from 'node:crypto';

const BASE = process.env.COMPASS_BASE_URL ?? 'http://localhost:3000';
const TOKEN = process.env.COMPASS_WEBHOOK_TOKEN;
const SECRET = process.env.COMPASS_WEBHOOK_HMAC_SECRET;

const project = process.argv[2];
const objective = process.argv[3] ?? 'Simulated overnight build: tighten tests, ship the feature.';

if (!project || !TOKEN || !SECRET) {
  console.error(
    'usage: COMPASS_WEBHOOK_TOKEN=… COMPASS_WEBHOOK_HMAC_SECRET=… pnpm tsx scripts/simulate-run.ts <project-slug-or-ulid> ["objective"]',
  );
  process.exit(1);
}

function ulid(): string {
  const alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  const bytes = randomBytes(26);
  for (let i = 0; i < 26; i++) s += alpha[(bytes[i] as number) % 32];
  return s;
}

async function post(event_seq: number, event_type: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({
    run_id: RUN_ID,
    project_slug: project,
    event_seq,
    event_type,
    occurred_at: new Date().toISOString(),
    payload,
  });
  const sig = `sha256=${createHmac('sha256', SECRET as string)
    .update(body)
    .digest('hex')}`;
  const res = await fetch(`${BASE}/webhooks/v1/runs/events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-compass-signature': sig,
      'content-type': 'application/json',
    },
    body,
  });
  const text = await res.text();
  console.log(
    `[simulate-run] ${event_type} (seq ${event_seq}) → ${res.status} ${text.slice(0, 160)}`,
  );
  if (!res.ok) process.exit(1);
}

const RUN_ID = ulid();
const startedAt = Date.now();

console.log(`[simulate-run] run ${RUN_ID} against project "${project}"`);
await post(0, 'queued', { objective });
await new Promise((r) => setTimeout(r, 500));
await post(1, 'started', {});
await new Promise((r) => setTimeout(r, 500));
await post(2, 'progress', { body_markdown: 'Halfway: tests green, wiring the UI.' });
await new Promise((r) => setTimeout(r, 500));
await post(3, 'completed', {
  result: 'succeeded',
  body_markdown: `Done: ${objective}`,
  links: [{ kind: 'pr', url: 'https://example.com/pr/42', label: 'PR #42' }],
  duration_ms: Date.now() - startedAt,
});
console.log('[simulate-run] complete — check the project page and dashboard overnight card.');
