import * as React from 'react';
import type { ProjectStage } from '@compass/shared';
import { cn } from '@/lib/cn';

/**
 * Per-stage color treatment. All values come from theme tokens to honor data-theme.
 * The two "themed" stages (prd, review) use fixed HSL hues since they're identity
 * colors that don't have a token (matches spec §8.1).
 */
const STAGE_STYLES: Record<ProjectStage, string> = {
  idea: 'bg-[hsl(var(--color-text-muted)/0.15)] text-text-muted',
  prd: 'bg-[hsl(45_80%_60%/0.18)] text-[hsl(45_80%_40%)]',
  building: 'bg-accent/15 text-accent',
  review: 'bg-[hsl(280_60%_60%/0.18)] text-[hsl(280_55%_55%)]',
  shipped: 'bg-success/15 text-success',
  archived: 'bg-[hsl(var(--color-text-subtle)/0.15)] text-text-subtle',
};

const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: 'Idea',
  prd: 'PRD',
  building: 'Building',
  review: 'Review',
  shipped: 'Shipped',
  archived: 'Archived',
};

export interface StagePillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  stage: ProjectStage;
  /** Override the displayed label. Defaults to the stage's title-case form. */
  label?: string;
}

export function StagePill({ stage, label, className, ...rest }: StagePillProps) {
  return (
    <span
      data-stage={stage}
      className={cn(
        'inline-flex h-5 items-center px-1.5',
        'rounded-sm text-2xs font-semibold uppercase tracking-[0.05em]',
        STAGE_STYLES[stage],
        className,
      )}
      {...rest}
    >
      {label ?? STAGE_LABELS[stage]}
    </span>
  );
}
