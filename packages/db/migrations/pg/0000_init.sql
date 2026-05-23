-- Initial Compass schema (Postgres). Hand-rolled to match packages/db/src/schema/pg.ts.

CREATE TABLE "user" (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
--> statement-breakpoint

CREATE TABLE auth_token (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
--> statement-breakpoint
CREATE INDEX auth_token_scope_idx ON auth_token(scope);
--> statement-breakpoint

CREATE TABLE device_code (
  device_code TEXT PRIMARY KEY NOT NULL,
  user_code TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  denied BOOLEAN NOT NULL DEFAULT FALSE,
  token_id TEXT,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
--> statement-breakpoint

CREATE TABLE project (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_markdown TEXT,
  prd_url TEXT,
  stage TEXT NOT NULL DEFAULT 'idea',
  status TEXT NOT NULL DEFAULT 'active',
  progress_pct INTEGER,
  target_date TEXT,
  repo_url TEXT,
  deploy_url TEXT,
  design_url TEXT,
  snoozed_until TEXT,
  snooze_reason TEXT,
  stall_threshold_days INTEGER,
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX project_stage_idx ON project(stage);
--> statement-breakpoint
CREATE INDEX project_touched_idx ON project(last_touched_at);
--> statement-breakpoint

CREATE TABLE learning_goal (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  motivation TEXT,
  body_markdown TEXT,
  status TEXT NOT NULL DEFAULT 'curious',
  target_date TEXT,
  snoozed_until TEXT,
  snooze_reason TEXT,
  stall_threshold_days INTEGER,
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX learning_goal_status_idx ON learning_goal(status);
--> statement-breakpoint
CREATE INDEX learning_goal_touched_idx ON learning_goal(last_touched_at);
--> statement-breakpoint

CREATE TABLE note (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  body_markdown TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  inbox_type_hint TEXT NOT NULL DEFAULT 'unspecified',
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX note_entity_idx ON note(entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX note_inbox_idx ON note(entity_id, created_at);
--> statement-breakpoint

CREATE TABLE milestone (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX milestone_project_idx ON milestone(project_id, order_index);
--> statement-breakpoint

CREATE TABLE checklist_item (
  id TEXT PRIMARY KEY NOT NULL,
  learning_goal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX checklist_item_lg_idx ON checklist_item(learning_goal_id, order_index);
--> statement-breakpoint

CREATE TABLE resource (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author_source TEXT,
  url TEXT,
  kind TEXT NOT NULL DEFAULT 'article',
  reading_status TEXT NOT NULL DEFAULT 'to_read',
  rating INTEGER,
  learning_goal_id TEXT,
  note_id TEXT,
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX resource_status_idx ON resource(reading_status);
--> statement-breakpoint
CREATE INDEX resource_lg_idx ON resource(learning_goal_id);
--> statement-breakpoint

CREATE TABLE build_run (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  body_markdown TEXT,
  links_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  ended_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL,
  last_touched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX build_run_project_idx ON build_run(project_id, created_at);
--> statement-breakpoint

CREATE TABLE activity_event (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX activity_event_entity_idx ON activity_event(entity_type, entity_id, occurred_at);
--> statement-breakpoint
CREATE INDEX activity_event_type_idx ON activity_event(event_type, occurred_at);
--> statement-breakpoint

CREATE TABLE run_event_dedup (
  run_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  activity_event_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (run_id, event_seq)
);
--> statement-breakpoint

CREATE TABLE tag (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX tag_name_idx ON tag(name);
--> statement-breakpoint

CREATE TABLE tagging (
  tag_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);
--> statement-breakpoint
CREATE INDEX tagging_entity_idx ON tagging(entity_type, entity_id);
--> statement-breakpoint

CREATE TABLE settings (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'SINGLETON',
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint

CREATE TABLE notifications (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  channel TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
--> statement-breakpoint
CREATE INDEX notifications_status_idx ON notifications(status, created_at);
--> statement-breakpoint

CREATE TABLE stall_alerts (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  last_alerted_at TEXT NOT NULL,
  alert_count INTEGER NOT NULL DEFAULT 1,
  suppressed_until TEXT,
  PRIMARY KEY (entity_type, entity_id)
);
--> statement-breakpoint

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  endpoint TEXT NOT NULL,
  received_at TEXT NOT NULL,
  headers_json TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL,
  dedup_key TEXT,
  error_message TEXT
);
--> statement-breakpoint
CREATE INDEX webhook_deliveries_recv_idx ON webhook_deliveries(received_at);
--> statement-breakpoint

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX audit_log_at_idx ON audit_log(at);
--> statement-breakpoint

CREATE TABLE capture_dedup (
  client_id TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  note_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (client_id, idem_key)
);
