'use client';

import { StallBadge } from '@/components/ui/stall-badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import type { ProjectStage } from '@compass/shared';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export interface BoardCard {
  id: string;
  title: string;
  stage: ProjectStage;
  progress_pct: number | null;
  stalled_days: number | null;
  snoozed: boolean;
}

const COLUMNS: Array<{ stage: ProjectStage; label: string }> = [
  { stage: 'idea', label: 'Idea' },
  { stage: 'prd', label: 'PRD' },
  { stage: 'building', label: 'Building' },
  { stage: 'review', label: 'Review' },
  { stage: 'shipped', label: 'Shipped' },
];

/**
 * Kanban board over project stages using native HTML5 drag-and-drop.
 * Keyboard users change stage via the StageSelect on the project detail page.
 */
export function ProjectBoard({ cards }: { cards: BoardCard[] }) {
  const router = useRouter();
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<ProjectStage | null>(null);
  // Optimistic stage overrides so the card lands instantly while the PATCH runs.
  const [moved, setMoved] = React.useState<Record<string, ProjectStage>>({});

  const stageOf = (c: BoardCard) => moved[c.id] ?? c.stage;

  async function moveTo(id: string, stage: ProjectStage) {
    const card = cards.find((c) => c.id === id);
    if (!card || stageOf(card) === stage) return;
    setMoved((m) => ({ ...m, [id]: stage }));
    try {
      const res = await fetch(`/api/v1/projects/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        setMoved((m) => {
          const { [id]: _dropped, ...rest } = m;
          return rest;
        });
        toast({ variant: 'danger', title: 'Move failed', description: `HTTP ${res.status}` });
        return;
      }
      router.refresh();
    } catch {
      setMoved((m) => {
        const { [id]: _dropped, ...rest } = m;
        return rest;
      });
      toast({ variant: 'danger', title: 'Network error' });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const colCards = cards.filter((c) => stageOf(c) === col.stage);
        return (
          <section
            key={col.stage}
            aria-label={`${col.label} column`}
            className={cn(
              'flex min-h-[12rem] flex-col rounded-lg border border-border/50 bg-surface/40 p-2 transition-colors',
              overStage === col.stage && dragId ? 'border-accent bg-accent-soft/40' : '',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(col.stage);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setOverStage(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/compass-project');
              setOverStage(null);
              setDragId(null);
              if (id) void moveTo(id, col.stage);
            }}
          >
            <h3 className="mb-2 flex items-center justify-between px-1 text-2xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              {col.label}
              <span className="tabular-nums">{colCards.length}</span>
            </h3>
            <div className="flex flex-1 flex-col gap-2">
              {colCards.map((c) => (
                <article
                  key={c.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/compass-project', c.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId(c.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                  className={cn(
                    'group rounded-md border border-border/60 bg-surface p-2.5 shadow-sm',
                    'hover-lift cursor-grab active:cursor-grabbing',
                    dragId === c.id ? 'opacity-50' : '',
                    c.snoozed ? 'opacity-60' : '',
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical
                      className="mt-0.5 size-3 shrink-0 text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${c.id}`}
                        className="block truncate text-sm font-medium text-text-primary hover:underline"
                        draggable={false}
                      >
                        {c.title}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-2">
                        {c.progress_pct !== null ? (
                          <span className="flex flex-1 items-center gap-1.5">
                            <span
                              className="h-1 flex-1 overflow-hidden rounded-full bg-surface-elevated"
                              aria-hidden
                            >
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{ width: `${c.progress_pct}%` }}
                              />
                            </span>
                            <span className="text-2xs tabular-nums text-text-muted">
                              {c.progress_pct}%
                            </span>
                          </span>
                        ) : (
                          <span className="flex-1" />
                        )}
                        {c.stalled_days !== null ? <StallBadge days={c.stalled_days} /> : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
