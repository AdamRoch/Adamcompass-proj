import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { indexNote, removeFromIndex } from '@/lib/index-entity';
import * as notesQ from '@compass/db/queries/notes';
import { ApiError } from '@compass/shared';
import { updateNoteSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const note = await notesQ.getNote(id);
    if (!note) throw new ApiError('not_found', 'note not found', 404);
    return ok({ note });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, updateNoteSchema);
    const existing = await notesQ.getNote(id);
    if (!existing) throw new ApiError('not_found', 'note not found', 404);
    const note = await notesQ.updateNoteBody(
      id,
      body.body_markdown ?? existing.body_markdown,
      body.title,
    );
    await indexNote(id);
    return ok({ note });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const removed = await notesQ.deleteNote(id);
    if (!removed) throw new ApiError('not_found', 'note not found', 404);
    await removeFromIndex('note', id);
    return ok({ removed: true });
  } catch (e) {
    return fromApiError(e);
  }
}
