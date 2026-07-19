// Entity types referenced across packages (polymorphic activity_event, search, etc.)
export const ENTITY_TYPES = [
  'project',
  'learning_goal',
  'note',
  'milestone',
  'checklist_item',
  'resource',
  'build_run',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const PROJECT_STAGES = ['idea', 'prd', 'building', 'review', 'shipped', 'archived'] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_STATUSES = ['active', 'parked', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const LEARNING_STATUSES = [
  'curious',
  'in_progress',
  'completed',
  'parked',
  'archived',
] as const;
export type LearningStatus = (typeof LEARNING_STATUSES)[number];

export const RESOURCE_KINDS = ['article', 'book', 'paper', 'video', 'course', 'other'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const READING_STATUSES = ['to_read', 'reading', 'read', 'abandoned'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export const RUN_RESULTS = ['queued', 'started', 'progress', 'completed', 'failed'] as const;
export type RunResult = (typeof RUN_RESULTS)[number];

export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const INBOX_TYPE_HINTS = ['idea', 'note', 'curiosity', 'unspecified'] as const;
export type InboxTypeHint = (typeof INBOX_TYPE_HINTS)[number];

export const ACTIVITY_EVENT_TYPES = [
  'created',
  'updated',
  'stage_changed',
  'status_changed',
  'milestone_completed',
  'note_added',
  'snoozed',
  'unsnoozed',
  'archived',
  'unarchived',
  'tagged',
  'untagged',
  'filed',
  'run_event',
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const NOTIFICATION_KINDS = ['daily_digest', 'stall_alert', 'build_run_event'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ['telegram'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'suppressed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const WEBHOOK_DELIVERY_STATUSES = [
  'accepted',
  'rejected_auth',
  'rejected_signature',
  'duplicate',
  'internal_error',
] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const TOKEN_SCOPES = ['cli', 'helper', 'webhook'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export const THEMES = [
  'white_minimal',
  'dark_minimal',
  'outer_space',
  'white_sand',
  'dark_forest',
] as const;
export type Theme = (typeof THEMES)[number];

export const DB_DIALECTS = ['sqlite', 'pg'] as const;
export type DbDialect = (typeof DB_DIALECTS)[number];

// Common record shapes returned by APIs (subset; full Drizzle inferred types live in @compass/db)
export interface ULIDString {
  __ulid: never;
}
export type ULID = string;

export interface BaseEntity {
  id: ULID;
  created_at: string;
  last_touched_at: string;
}

export interface Project extends BaseEntity {
  title: string;
  slug: string | null;
  summary: string | null;
  body_markdown: string | null;
  prd_url: string | null;
  prd_markdown: string | null;
  stage: ProjectStage;
  status: ProjectStatus;
  progress_pct: number | null;
  target_date: string | null;
  repo_url: string | null;
  deploy_url: string | null;
  design_url: string | null;
  snoozed_until: string | null;
  snooze_reason: string | null;
  stall_threshold_days: number | null;
}

export interface LearningGoal extends BaseEntity {
  title: string;
  motivation: string | null;
  body_markdown: string | null;
  status: LearningStatus;
  target_date: string | null;
  snoozed_until: string | null;
  snooze_reason: string | null;
  stall_threshold_days: number | null;
}

export interface Note extends BaseEntity {
  title: string | null;
  body_markdown: string;
  entity_type: 'project' | 'learning_goal' | null;
  entity_id: ULID | null;
  inbox_type_hint: InboxTypeHint;
}

export interface ActivityEvent {
  id: ULID;
  entity_type: EntityType;
  entity_id: ULID;
  event_type: ActivityEventType;
  payload_json: string;
  occurred_at: string;
  received_at: string;
}

export interface Tag {
  id: ULID;
  name: string;
}

export interface Settings {
  timezone: string;
  default_stall_threshold_project_days: number;
  default_stall_threshold_learning_days: number;
  quiet_hours_start: string; // "HH:MM"
  quiet_hours_end: string;
  digest_send_time: string;
  notif_telegram_enabled: boolean;
  notif_digest_enabled: boolean;
  notif_stall_enabled: boolean;
  notif_build_run_enabled: boolean;
  active_theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'America/Chicago',
  default_stall_threshold_project_days: 3,
  default_stall_threshold_learning_days: 2,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  digest_send_time: '09:00',
  notif_telegram_enabled: true,
  notif_digest_enabled: true,
  notif_stall_enabled: true,
  notif_build_run_enabled: true,
  active_theme: 'white_minimal',
};
