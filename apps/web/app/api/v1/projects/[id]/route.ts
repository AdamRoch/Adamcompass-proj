import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { indexProject } from '@/lib/index-entity';
import * as activityQ from '@compass/db/queries/activity';
import * as buildRunsQ from '@compass/db/queries/build_runs';
import * as notesQ from '@compass/db/queries/notes';
import * as projectsQ from '@compass/db/queries/projects';
import * as tagsQ from '@compass/db/queries/tags';
import { ApiError } from '@compass/shared';
import { updateProjectSchema } from '@compass/shared/zod';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const project = await projectsQ.getProject(id);
    if (!project) throw new ApiError('not_found', 'project not found', 404);
    const [notes, build_runs, activity_events, tags] = await Promise.all([
      notesQ.listNotesForEntity('project', id),
      buildRunsQ.listForProject(id),
      activityQ.listForEntity('project', id, 50),
      tagsQ.tagsForEntity('project', id),
    ]);
    return ok({ project, notes, build_runs, activity_events, tags });
  } catch (e) {
    return fromApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = await readJson(req, updateProjectSchema);
    const updated = await projectsQ.updateProject(id, body as never);
    if (!updated) throw new ApiError('not_found', 'project not found', 404);
    await indexProject(id);
    return ok({ project: updated });
  } catch (e) {
    return fromApiError(e);
  }
}
