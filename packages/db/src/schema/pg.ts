import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Mirrors sqlite.ts; uses TEXT for timestamps for cross-dialect portability of comparisons.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull(),
  last_login_at: text('last_login_at'),
});

export const auth_token = pgTable(
  'auth_token',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    token_hash: text('token_hash').notNull(),
    scope: text('scope').notNull(),
    created_at: text('created_at').notNull(),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
  },
  (t) => ({
    scopeIdx: index('auth_token_scope_idx').on(t.scope),
  }),
);

export const device_code = pgTable('device_code', {
  device_code: text('device_code').primaryKey(),
  user_code: text('user_code').notNull(),
  approved: boolean('approved').notNull().default(false),
  denied: boolean('denied').notNull().default(false),
  token_id: text('token_id'),
  pending_plain_token: text('pending_plain_token'),
  scope: text('scope').notNull(),
  created_at: text('created_at').notNull(),
  expires_at: text('expires_at').notNull(),
});

export const project = pgTable(
  'project',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug'),
    summary: text('summary'),
    body_markdown: text('body_markdown'),
    prd_url: text('prd_url'),
    prd_markdown: text('prd_markdown'),
    stage: text('stage').notNull().default('idea'),
    status: text('status').notNull().default('active'),
    progress_pct: integer('progress_pct'),
    target_date: text('target_date'),
    repo_url: text('repo_url'),
    deploy_url: text('deploy_url'),
    design_url: text('design_url'),
    snoozed_until: text('snoozed_until'),
    snooze_reason: text('snooze_reason'),
    stall_threshold_days: integer('stall_threshold_days'),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    stageIdx: index('project_stage_idx').on(t.stage),
    touchedIdx: index('project_touched_idx').on(t.last_touched_at),
    slugIdx: uniqueIndex('project_slug_idx').on(t.slug).where(sql`slug IS NOT NULL`),
  }),
);

export const learning_goal = pgTable(
  'learning_goal',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    motivation: text('motivation'),
    body_markdown: text('body_markdown'),
    status: text('status').notNull().default('curious'),
    target_date: text('target_date'),
    snoozed_until: text('snoozed_until'),
    snooze_reason: text('snooze_reason'),
    stall_threshold_days: integer('stall_threshold_days'),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    statusIdx: index('learning_goal_status_idx').on(t.status),
    touchedIdx: index('learning_goal_touched_idx').on(t.last_touched_at),
  }),
);

export const note = pgTable(
  'note',
  {
    id: text('id').primaryKey(),
    title: text('title'),
    body_markdown: text('body_markdown').notNull(),
    entity_type: text('entity_type'),
    entity_id: text('entity_id'),
    inbox_type_hint: text('inbox_type_hint').notNull().default('unspecified'),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    entityIdx: index('note_entity_idx').on(t.entity_type, t.entity_id),
    inboxIdx: index('note_inbox_idx').on(t.entity_id, t.created_at),
  }),
);

export const milestone = pgTable(
  'milestone',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull(),
    title: text('title').notNull(),
    done: boolean('done').notNull().default(false),
    order_index: integer('order_index').notNull().default(0),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    projIdx: index('milestone_project_idx').on(t.project_id, t.order_index),
  }),
);

export const checklist_item = pgTable(
  'checklist_item',
  {
    id: text('id').primaryKey(),
    learning_goal_id: text('learning_goal_id').notNull(),
    title: text('title').notNull(),
    done: boolean('done').notNull().default(false),
    order_index: integer('order_index').notNull().default(0),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    lgIdx: index('checklist_item_lg_idx').on(t.learning_goal_id, t.order_index),
  }),
);

export const resource = pgTable(
  'resource',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    author_source: text('author_source'),
    url: text('url'),
    kind: text('kind').notNull().default('article'),
    reading_status: text('reading_status').notNull().default('to_read'),
    rating: integer('rating'),
    learning_goal_id: text('learning_goal_id'),
    note_id: text('note_id'),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    statusIdx: index('resource_status_idx').on(t.reading_status),
    lgIdx: index('resource_lg_idx').on(t.learning_goal_id),
  }),
);

export const build_run = pgTable(
  'build_run',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull(),
    objective: text('objective'),
    status: text('status').notNull().default('queued'),
    body_markdown: text('body_markdown'),
    links_json: text('links_json').notNull().default('[]'),
    started_at: text('started_at'),
    ended_at: text('ended_at'),
    duration_ms: integer('duration_ms'),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    projIdx: index('build_run_project_idx').on(t.project_id, t.created_at),
  }),
);

export const activity_event = pgTable(
  'activity_event',
  {
    id: text('id').primaryKey(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    event_type: text('event_type').notNull(),
    payload_json: text('payload_json').notNull().default('{}'),
    occurred_at: text('occurred_at').notNull(),
    received_at: text('received_at').notNull(),
  },
  (t) => ({
    entityIdx: index('activity_event_entity_idx').on(t.entity_type, t.entity_id, t.occurred_at),
    typeIdx: index('activity_event_type_idx').on(t.event_type, t.occurred_at),
  }),
);

export const run_event_dedup = pgTable(
  'run_event_dedup',
  {
    run_id: text('run_id').notNull(),
    event_seq: integer('event_seq').notNull(),
    activity_event_id: text('activity_event_id').notNull(),
    received_at: text('received_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.run_id, t.event_seq] }),
  }),
);

export const tag = pgTable(
  'tag',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex('tag_name_idx').on(t.name),
  }),
);

export const tagging = pgTable(
  'tagging',
  {
    tag_id: text('tag_id').notNull(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tag_id, t.entity_type, t.entity_id] }),
    entityIdx: index('tagging_entity_idx').on(t.entity_type, t.entity_id),
  }),
);

export const settings = pgTable('settings', {
  id: text('id').primaryKey().default('SINGLETON'),
  data_json: text('data_json').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    entity_type: text('entity_type'),
    entity_id: text('entity_id'),
    channel: text('channel').notNull(),
    payload_json: text('payload_json').notNull(),
    status: text('status').notNull().default('pending'),
    error_message: text('error_message'),
    retry_count: integer('retry_count').notNull().default(0),
    next_attempt_at: text('next_attempt_at'),
    created_at: text('created_at').notNull(),
    sent_at: text('sent_at'),
  },
  (t) => ({
    statusIdx: index('notifications_status_idx').on(t.status, t.created_at),
    nextAttemptIdx: index('notifications_next_attempt_idx').on(t.next_attempt_at),
  }),
);

export const stall_alerts = pgTable(
  'stall_alerts',
  {
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    last_alerted_at: text('last_alerted_at').notNull(),
    alert_count: integer('alert_count').notNull().default(1),
    suppressed_until: text('suppressed_until'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entity_type, t.entity_id] }),
  }),
);

export const webhook_deliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    endpoint: text('endpoint').notNull(),
    received_at: text('received_at').notNull(),
    headers_json: text('headers_json').notNull(),
    body_text: text('body_text').notNull(),
    status: text('status').notNull(),
    dedup_key: text('dedup_key'),
    error_message: text('error_message'),
  },
  (t) => ({
    recvIdx: index('webhook_deliveries_recv_idx').on(t.received_at),
  }),
);

export const audit_log = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entity_type: text('entity_type'),
    entity_id: text('entity_id'),
    metadata_json: text('metadata_json').notNull().default('{}'),
    at: text('at').notNull(),
  },
  (t) => ({
    atIdx: index('audit_log_at_idx').on(t.at),
  }),
);

export const capture_dedup = pgTable(
  'capture_dedup',
  {
    client_id: text('client_id').notNull(),
    idem_key: text('idem_key').notNull(),
    note_id: text('note_id').notNull(),
    created_at: text('created_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.client_id, t.idem_key] }),
  }),
);

// Postgres search uses a dedicated table with a tsvector column; managed via raw SQL in the
// search provider for indexing and querying.
export const SEARCH_INDEX_TABLE = 'search_index';
export const SEARCH_INDEX_CREATE_SQL = sql`
  CREATE TABLE IF NOT EXISTS search_index (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    tsv tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(body, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(tags, '')), 'C')
    ) STORED,
    PRIMARY KEY (entity_type, entity_id)
  );
  CREATE INDEX IF NOT EXISTS search_index_tsv_idx ON search_index USING gin(tsv);
`;
