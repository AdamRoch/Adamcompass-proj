'use server';

import { requireUserOrRedirect } from '@/lib/auth';
import { indexLearningGoal, indexNote } from '@/lib/index-entity';
import * as learningQ from '@compass/db/queries/learning';
import { revalidatePath } from 'next/cache';

export async function promoteCuriosityAction(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const noteId = String(formData.get('note_id') ?? '');
  if (!noteId) return;
  const goal = await learningQ.promoteCuriosityNote(noteId);
  if (goal) {
    await indexLearningGoal(goal.id);
    await indexNote(noteId);
  }
  revalidatePath('/inbox');
  revalidatePath('/learning');
}
