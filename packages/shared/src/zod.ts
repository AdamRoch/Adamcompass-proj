import { z } from 'zod';
import {
  INBOX_TYPE_HINTS,
  LEARNING_STATUSES,
  PROJECT_STAGES,
  PROJECT_STATUSES,
  READING_STATUSES,
  RESOURCE_KINDS,
  RUN_RESULTS,
  THEMES,
} from './types.js';

export const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a ULID');

export const isoTimestampSchema = z.string().datetime({ offset: true });

// ------ Capture ------

export const captureRequestSchema = z.object({
  idem_key: z.string().min(8).max(128),
  client_id: z.string().min(1).max(64),
  body: z.string().min(1).max(50_000),
  type_hint: z.enum(INBOX_TYPE_HINTS).optional().default('unspecified'),
  tags: z.array(z.string().min(1).max(64)).max(20).optional().default([]),
  captured_at: isoTimestampSchema.optional(),
});
export type CaptureRequest = z.infer<typeof captureRequestSchema>;

// ------ Inbox file ------

export const fileFromInboxSchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('existing'),
    target_type: z.enum(['project', 'learning_goal']),
    target_id: ulidSchema,
  }),
  z.object({
    target: z.literal('new_project'),
    title: z.string().min(1).max(200),
  }),
  z.object({
    target: z.literal('new_learning_goal'),
    title: z.string().min(1).max(200),
  }),
  z.object({ target: z.literal('keep_unfiled_note') }),
]);

// ------ Projects ------

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  body_markdown: z.string().max(200_000).optional(),
  prd_url: z.string().url().optional(),
  stage: z.enum(PROJECT_STAGES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  target_date: z.string().date().optional(),
  repo_url: z.string().url().optional(),
  deploy_url: z.string().url().optional(),
  design_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const snoozeSchema = z.object({
  until: isoTimestampSchema.refine(
    (s) => Date.parse(s) > Date.now(),
    { message: 'snooze "until" must be a future timestamp' },
  ),
  reason: z.string().min(1).max(500),
});

// ------ Learning goals ------

export const createLearningGoalSchema = z.object({
  title: z.string().min(1).max(200),
  motivation: z.string().max(500).optional(),
  body_markdown: z.string().max(200_000).optional(),
  status: z.enum(LEARNING_STATUSES).optional(),
  target_date: z.string().date().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateLearningGoalSchema = createLearningGoalSchema.partial();

// ------ Resources (reading list) ------

export const createResourceSchema = z.object({
  title: z.string().min(1).max(300),
  author_source: z.string().max(200).optional(),
  url: z.string().url().optional(),
  kind: z.enum(RESOURCE_KINDS).default('article'),
  reading_status: z.enum(READING_STATUSES).default('to_read'),
  rating: z.number().int().min(1).max(5).optional(),
  learning_goal_id: ulidSchema.optional(),
});

// ------ Settings ------

export const settingsPatchSchema = z
  .object({
    timezone: z.string().min(1).max(64),
    default_stall_threshold_project_days: z.number().int().min(1).max(365),
    default_stall_threshold_learning_days: z.number().int().min(1).max(365),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/),
    digest_send_time: z.string().regex(/^\d{2}:\d{2}$/),
    notif_telegram_enabled: z.boolean(),
    notif_digest_enabled: z.boolean(),
    notif_stall_enabled: z.boolean(),
    notif_build_run_enabled: z.boolean(),
    active_theme: z.enum(THEMES),
  })
  .partial();

// ------ Webhook ------

export const webhookRunEventSchema = z.object({
  run_id: ulidSchema,
  // NOTE: the field is named `project_slug` in the public webhook contract (PRD §7.2) but in v1
  // it is treated as the project's ULID — we look it up via `projectsQ.getProject(id)`.
  // TODO(v2): support human-readable slugs and resolve them to a ULID server-side; until then,
  // keep the field name to preserve compatibility with existing agent integrations.
  project_slug: ulidSchema,
  event_seq: z.number().int().min(0),
  event_type: z.enum(RUN_RESULTS),
  occurred_at: isoTimestampSchema,
  payload: z.object({
    result: z.enum(['queued', 'running', 'completed', 'failed', 'succeeded']).optional(),
    body_markdown: z.string().max(200_000).optional(),
    links: z
      .array(
        z.object({
          kind: z.string().max(32),
          url: z.string().url(),
          label: z.string().max(120).optional(),
        }),
      )
      .max(30)
      .optional(),
    duration_ms: z.number().int().min(0).optional(),
    objective: z.string().max(2000).optional(),
  }),
});
export type WebhookRunEvent = z.infer<typeof webhookRunEventSchema>;

// ------ Tags ------

export const createTagSchema = z.object({ name: z.string().min(1).max(64) });
export const updateTagSchema = z.object({ name: z.string().min(1).max(64) });

// ------ Auth: device code flow ------

export const devicePollSchema = z.object({ device_code: z.string().min(8).max(128) });
