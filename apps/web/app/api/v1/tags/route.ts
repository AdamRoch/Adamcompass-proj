import type { NextRequest } from 'next/server';
import * as tagsQ from '@compass/db/queries/tags';
import { createTagSchema } from '@compass/shared/zod';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const tags = await tagsQ.listWithCounts();
    return ok({ tags });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await readJson(req, createTagSchema);
    const tag = await tagsQ.ensure(body.name);
    return ok({ tag }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
