-- V2: project slug + in-app PRD, dedicated pending token for device-code flow.
ALTER TABLE project ADD COLUMN slug TEXT;
--> statement-breakpoint
ALTER TABLE project ADD COLUMN prd_markdown TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX project_slug_idx ON project(slug) WHERE slug IS NOT NULL;
--> statement-breakpoint
ALTER TABLE device_code ADD COLUMN pending_plain_token TEXT;
