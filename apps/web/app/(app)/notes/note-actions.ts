'use server';

import { requireUserOrRedirect } from '@/lib/auth';
import { indexNote, removeFromIndex } from '@/lib/index-entity';
import * as notesQ from '@compass/db/queries/notes';
import { revalidatePath } from 'next/cache';

export async function updateNoteAction(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  const body = String(formData.get('body_markdown') ?? '').trim();
  const titleRaw = formData.get('title');
  if (!id || !body) return;
  await notesQ.updateNoteBody(
    id,
    body.slice(0, 200_000),
    titleRaw === null ? undefined : String(titleRaw).slice(0, 300) || null,
  );
  await indexNote(id);
  revalidatePath('/notes');
  revalidatePath('/inbox');
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const removed = await notesQ.deleteNote(id);
  if (removed) await removeFromIndex('note', id);
  revalidatePath('/notes');
  revalidatePath('/inbox');
}
