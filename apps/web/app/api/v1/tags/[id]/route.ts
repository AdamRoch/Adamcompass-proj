import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { reindexEntity } from '@/lib/index-entity';
import * as tagsQ from '@compass/db/queries/tags';
import { ApiError } from '@compass/shared';
import { updateTagSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, updateTagSchema);
    await tagsQ.rename(id, body.name);
    // FTS rows store tag NAMES — refresh every entity carrying this tag.
    for (const t of await tagsQ.taggingsForTag(id)) {
      await reindexEntity(t.entity_type, t.entity_id);
    }
    return ok({ ok: true });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const removed = await tagsQ.removeIfUnused(id);
    if (!removed) {
      throw new ApiError('conflict', 'tag is still in use (or does not exist)', 409);
    }
    return ok({ removed: true });
  } catch (e) {
    return fromApiError(e);
  }
}
