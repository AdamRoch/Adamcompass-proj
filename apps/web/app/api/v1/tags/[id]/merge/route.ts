import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { reindexEntity } from '@/lib/index-entity';
import * as tagsQ from '@compass/db/queries/tags';
import { ApiError } from '@compass/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const mergeSchema = z.object({ into: z.string().min(1) });

/** Merge this tag into another: taggings move to `into`, this tag is deleted. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, mergeSchema);
    // Snapshot the affected entities BEFORE the source tag disappears.
    const affected = await tagsQ.taggingsForTag(id);
    const merged = await tagsQ.merge(id, body.into);
    if (!merged) throw new ApiError('not_found', 'tag (or merge target) not found', 404);
    for (const t of affected) {
      await reindexEntity(t.entity_type, t.entity_id);
    }
    return ok({ merged: true });
  } catch (e) {
    return fromApiError(e);
  }
}
