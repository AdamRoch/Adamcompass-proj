import type { NextRequest } from 'next/server';
import * as tagsQ from '@compass/db/queries/tags';
import { updateTagSchema } from '@compass/shared/zod';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, updateTagSchema);
    await tagsQ.rename(id, body.name);
    return ok({ ok: true });
  } catch (e) {
    return fromApiError(e);
  }
}
