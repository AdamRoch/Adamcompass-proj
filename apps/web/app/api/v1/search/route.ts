import type { NextRequest } from 'next/server';
import { getSearch } from '@compass/search';
import { fromApiError, ok, requireAuth } from '@/lib/api';
import type { EntityType } from '@compass/shared';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (!q) return ok({ hits: [] });
    const typesParam = url.searchParams.get('types');
    const tagsParam = url.searchParams.get('tags');
    const limit = Math.min(50, Number(url.searchParams.get('limit') ?? 20));
    const types = typesParam ? (typesParam.split(',') as EntityType[]) : undefined;
    const tags = tagsParam ? tagsParam.split(',') : undefined;
    const hits = await getSearch().query({ q, types, tags, limit });
    return ok({ hits });
  } catch (e) {
    return fromApiError(e);
  }
}
