'use server';

import { requireUserOrRedirect } from '@/lib/auth';
import * as checklistQ from '@compass/db/queries/checklist';
import { revalidatePath } from 'next/cache';

export type ChecklistItemRow = checklistQ.ChecklistItemRow;

export async function toggleChecklistItem(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  const goalId = String(formData.get('goal_id') ?? '');
  if (!id || !goalId) return;
  await checklistQ.toggleDone(id);
  revalidatePath(`/learning/${goalId}`);
}

export async function addChecklistItem(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const goalId = String(formData.get('goal_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!goalId || !title) return;
  await checklistQ.add({ learning_goal_id: goalId, title });
  revalidatePath(`/learning/${goalId}`);
}
