'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
type LearningStatus = 'curious' | 'in_progress' | 'completed' | 'parked' | 'archived';
const LEARNING_STATUSES: readonly LearningStatus[] = [
  'curious',
  'in_progress',
  'completed',
  'parked',
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

const LABELS: Record<LearningStatus, string> = {
  curious: 'Curious',
  in_progress: 'In progress',
  completed: 'Completed',
  parked: 'Parked',
  archived: 'Archived',
};

export function StatusSelect({ id, current }: { id: string; current: LearningStatus }) {
  const router = useRouter();
  const [value, setValue] = React.useState<LearningStatus>(current);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setValue(current), [current]);

  async function changeStatus(next: string) {
    const status = next as LearningStatus;
    if (status === value) return;
    const prev = value;
    setValue(status);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/learning-goals/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setValue(prev);
        toast({ variant: 'danger', title: 'Failed to change status' });
        return;
      }
      toast({ variant: 'success', title: `Status → ${LABELS[status]}` });
      router.refresh();
    } catch (err) {
      setValue(prev);
      toast({
        variant: 'danger',
        title: 'Failed to change status',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select value={value} onValueChange={changeStatus} disabled={busy}>
      <SelectTrigger className="h-7 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEARNING_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
