'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
type ProjectStage = 'idea' | 'prd' | 'building' | 'review' | 'shipped' | 'archived';
const PROJECT_STAGES: readonly ProjectStage[] = [
  'idea',
  'prd',
  'building',
  'review',
  'shipped',
  'archived',
];
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: 'Idea',
  prd: 'PRD',
  building: 'Building',
  review: 'Review',
  shipped: 'Shipped',
  archived: 'Archived',
};

export function StageSelect({ id, current }: { id: string; current: ProjectStage }) {
  const router = useRouter();
  const [value, setValue] = React.useState<ProjectStage>(current);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setValue(current), [current]);

  async function changeStage(next: string) {
    const stage = next as ProjectStage;
    if (stage === value) return;
    const prev = value;
    setValue(stage);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        setValue(prev);
        toast({ variant: 'danger', title: 'Failed to change stage' });
        return;
      }
      toast({ variant: 'success', title: `Stage → ${STAGE_LABELS[stage]}` });
      router.refresh();
    } catch (err) {
      setValue(prev);
      toast({
        variant: 'danger',
        title: 'Failed to change stage',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select value={value} onValueChange={changeStage} disabled={busy}>
      <SelectTrigger className="h-7 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            {STAGE_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
