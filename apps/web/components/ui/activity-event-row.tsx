'use client';

import { cn } from '@/lib/cn';
import type { ActivityEvent, ActivityEventType, EntityType } from '@compass/shared';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  Edit3,
  FileText,
  Flag,
  Hash,
  Inbox,
  Layers,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Tag,
  Zap,
} from 'lucide-react';
import type * as React from 'react';

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

const EVENT_ICON: Record<ActivityEventType, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  updated: Edit3,
  stage_changed: Layers,
  status_changed: Flag,
  milestone_completed: CheckCircle2,
  note_added: FileText,
  snoozed: Moon,
  unsnoozed: Sun,
  archived: Archive,
  unarchived: ArchiveRestore,
  tagged: Tag,
  untagged: Hash,
  filed: Inbox,
  run_event: Zap,
};

const EVENT_VERB: Record<ActivityEventType, string> = {
  created: 'created',
  updated: 'updated',
  stage_changed: 'changed stage of',
  status_changed: 'changed status of',
  milestone_completed: 'completed milestone in',
  note_added: 'added a note to',
  snoozed: 'snoozed',
  unsnoozed: 'unsnoozed',
  archived: 'archived',
  unarchived: 'unarchived',
  tagged: 'tagged',
  untagged: 'untagged',
  filed: 'filed',
  run_event: 'build run on',
};

const ENTITY_LABEL: Record<EntityType, string> = {
  project: 'project',
  learning_goal: 'goal',
  note: 'note',
  milestone: 'milestone',
  checklist_item: 'checklist item',
  resource: 'resource',
  build_run: 'build run',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  const deltaSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (deltaSec < 5) return 'now';
  if (deltaSec < 60) return `${deltaSec}s`;
  const min = Math.round(deltaSec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo`;
  return `${Math.round(day / 365)}y`;
}

/** Best-effort entity title from event payload JSON. */
function pickTitle(payload: string | null | undefined, fallback: string): string {
  if (!payload) return fallback;
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    for (const key of ['title', 'name', 'label']) {
      const v = obj[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  } catch {
    // ignore
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ActivityEventRowProps extends React.HTMLAttributes<HTMLDivElement> {
  event: ActivityEvent;
  /** Optional override title for the affected entity (avoids JSON parsing). */
  entityTitle?: string;
  /** Optional href to navigate to the entity. When set, the row is clickable. */
  href?: string;
}

export function ActivityEventRow({
  event,
  entityTitle,
  href,
  className,
  ...rest
}: ActivityEventRowProps) {
  const Icon = EVENT_ICON[event.event_type] ?? Sparkles;
  const verb = EVENT_VERB[event.event_type] ?? event.event_type.replace(/_/g, ' ');
  const entityLabel = ENTITY_LABEL[event.entity_type] ?? event.entity_type;
  const title = entityTitle ?? pickTitle(event.payload_json, entityLabel);
  const when = formatTimeAgo(event.occurred_at);
  const isoTitle = new Date(event.occurred_at).toLocaleString();

  const body = (
    <>
      <span className="inline-flex w-5 shrink-0 items-center justify-center text-text-muted">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-sm text-text-primary">
        <span className="text-text-muted">{verb}</span> <span className="font-medium">{title}</span>
        <span className="text-text-subtle"> · {entityLabel}</span>
      </div>
      <span
        title={isoTitle}
        className="w-[80px] shrink-0 text-right text-xs tabular-nums text-text-muted"
      >
        {when}
      </span>
      {href ? (
        <ArrowRight
          className="size-3.5 shrink-0 text-text-subtle group-hover/aer:text-text-primary"
          aria-hidden
        />
      ) : null}
    </>
  );

  const className_ = cn(
    'group/aer flex items-center gap-3 py-1.5 px-2 rounded-sm',
    href && 'hover:bg-surface-elevated/60 cursor-pointer',
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        className={className_}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {body}
      </a>
    );
  }

  return (
    <div className={className_} {...rest}>
      {body}
    </div>
  );
}

// Convenience re-export so callers can iterate by type
export { EVENT_VERB, EVENT_ICON };
