import type { NextRequest } from 'next/server';
import * as projectsQ from '@compass/db/queries/projects';
import { createProjectSchema } from '@compass/shared/zod';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { indexProject } from '@/lib/index-entity';
import type { ProjectStage } from '@compass/shared';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const stage = url.searchParams.get('stage') as ProjectStage | null;
    const status = url.searchParams.get('status');
    const includeArchived = url.searchParams.get('include_archived') === 'true';
    const limit = Number(url.searchParams.get('limit') ?? 200);
    const projects = await projectsQ.listProjects({
      stage: stage ?? undefined,
      status: status ?? undefined,
      includeArchived,
      limit,
    });
    return ok({ projects });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await readJson(req, createProjectSchema);
    const project = await projectsQ.createProject(body);
    await indexProject(project.id);
    return ok({ project }, { status: 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
