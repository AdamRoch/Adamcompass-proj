-- Add retry tracking to notifications so the drain can back off + retry transient send failures.
ALTER TABLE notifications ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN next_attempt_at TEXT;
--> statement-breakpoint
CREATE INDEX notifications_next_attempt_idx ON notifications(next_attempt_at);
