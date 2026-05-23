import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// All timestamps are ISO-8601 strings for portability with the PG path.
// Note: SQLite text comparison is lexicographic — ISO-8601 sorts correctly when zero-padded.

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull(),
  last_login_at: text('last_login_at'),
});

export const auth_token = sqliteTable(
  'auth_token',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    token_hash: text('token_hash').notNull(),
    scope: text('scope', { enum: ['cli', 'helper', 'webhook'] }).notNull(),
    created_at: text('created_at').notNull(),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
  },
  (t) => ({
    scopeIdx: index('auth_token_scope_idx').on(t.scope),
  }),
);

export const device_code = sqliteTable('device_code', {
  device_code: text('device_code').primaryKey(),
  user_code: text('user_code').notNull(),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
  denied: integer('denied', { mode: 'boolean' }).notNull().default(false),
  token_id: text('token_id'),
  scope: text('scope', { enum: ['cli', 'helper'] }).notNull(),
  created_at: text('created_at').notNull(),
  expires_at: text('expires_at').notNull(),
});

export const project = sqliteTable(
  'project',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    summary: text('summary'),
    body_markdown: text('body_markdown'),
    prd_url: text('prd_url'),
    stage: text('stage', {
      enum: ['idea', 'prd', 'building', 'review', 'shipped', 'archived'],
    })
      .notNull()
      .default('idea'),
    status: text('status', { enum: ['active', 'parked', 'done'] })
      .notNull()
      .default('active'),
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
  }),
);

export const learning_goal = sqliteTable(
  'learning_goal',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    motivation: text('motivation'),
    body_markdown: text('body_markdown'),
    status: text('status', {
      enum: ['curious', 'in_progress', 'completed', 'parked', 'archived'],
    })
      .notNull()
      .default('curious'),
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

export const note = sqliteTable(
  'note',
  {
    id: text('id').primaryKey(),
    title: text('title'),
    body_markdown: text('body_markdown').notNull(),
    entity_type: text('entity_type', { enum: ['project', 'learning_goal'] }),
    entity_id: text('entity_id'),
    inbox_type_hint: text('inbox_type_hint', {
      enum: ['idea', 'note', 'curiosity', 'unspecified'],
    })
      .notNull()
      .default('unspecified'),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    entityIdx: index('note_entity_idx').on(t.entity_type, t.entity_id),
    inboxIdx: index('note_inbox_idx').on(t.entity_id, t.created_at),
  }),
);

export const milestone = sqliteTable(
  'milestone',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull(),
    title: text('title').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    order_index: integer('order_index').notNull().default(0),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    projIdx: index('milestone_project_idx').on(t.project_id, t.order_index),
  }),
);

export const checklist_item = sqliteTable(
  'checklist_item',
  {
    id: text('id').primaryKey(),
    learning_goal_id: text('learning_goal_id').notNull(),
    title: text('title').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    order_index: integer('order_index').notNull().default(0),
    created_at: text('created_at').notNull(),
    last_touched_at: text('last_touched_at').notNull(),
  },
  (t) => ({
    lgIdx: index('checklist_item_lg_idx').on(t.learning_goal_id, t.order_index),
  }),
);

export const resource = sqliteTable(
  'resource',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    author_source: text('author_source'),
    url: text('url'),
    kind: text('kind', { enum: ['article', 'book', 'paper', 'video', 'course', 'other'] })
      .notNull()
      .default('article'),
    reading_status: text('reading_status', {
      enum: ['to_read', 'reading', 'read', 'abandoned'],
    })
      .notNull()
      .default('to_read'),
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

export const build_run = sqliteTable(
  'build_run',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull(),
    objective: text('objective'),
    status: text('status', { enum: ['queued', 'running', 'completed', 'failed'] })
      .notNull()
      .default('queued'),
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

export const activity_event = sqliteTable(
  'activity_event',
  {
    id: text('id').primaryKey(),
    entity_type: text('entity_type', {
      enum: [
        'project',
        'learning_goal',
        'note',
        'milestone',
        'checklist_item',
        'resource',
        'build_run',
      ],
    }).notNull(),
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

export const run_event_dedup = sqliteTable(
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

export const tag = sqliteTable(
  'tag',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex('tag_name_idx').on(t.name),
  }),
);

export const tagging = sqliteTable(
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

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('SINGLETON'),
  data_json: text('data_json').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['daily_digest', 'stall_alert', 'build_run_event'] }).notNull(),
    entity_type: text('entity_type'),
    entity_id: text('entity_id'),
    channel: text('channel', { enum: ['telegram'] }).notNull(),
    payload_json: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'sent', 'failed', 'suppressed'] })
      .notNull()
      .default('pending'),
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

export const stall_alerts = sqliteTable(
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

export const webhook_deliveries = sqliteTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    endpoint: text('endpoint').notNull(),
    received_at: text('received_at').notNull(),
    headers_json: text('headers_json').notNull(),
    body_text: text('body_text').notNull(),
    status: text('status', {
      enum: [
        'accepted',
        'rejected_auth',
        'rejected_signature',
        'duplicate',
        'internal_error',
      ],
    }).notNull(),
    dedup_key: text('dedup_key'),
    error_message: text('error_message'),
  },
  (t) => ({
    recvIdx: index('webhook_deliveries_recv_idx').on(t.received_at),
  }),
);

export const audit_log = sqliteTable(
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

export const capture_dedup = sqliteTable(
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

// FTS5 virtual table for SQLite. Drizzle doesn't have a first-class virtual table builder, so we
// run a raw CREATE in the migrate script (see migrate.ts) and use raw SQL in the search provider.
// Exporting a constant lets the search package reference it consistently.
export const SEARCH_INDEX_TABLE = 'search_index';
export const SEARCH_INDEX_CREATE_SQL = sql`
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type UNINDEXED,
    entity_id UNINDEXED,
    title,
    body,
    tags,
    tokenize = 'porter unicode61'
  );
`;
