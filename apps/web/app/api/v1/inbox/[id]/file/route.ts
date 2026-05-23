import type { NextRequest } from 'next/server';
import { fileFromInboxSchema } from '@compass/shared/zod';
import * as notesQ from '@compass/db/queries/notes';
import * as projectsQ from '@compass/db/queries/projects';
import * as learningQ from '@compass/db/queries/learning';
import * as adminQ from '@compass/db/queries/admin';
import { fromApiError, ok, readJson, requireAuth } from '@/lib/api';
import { ApiError } from '@compass/shared';
import { indexLearningGoal, indexNote, indexProject } from '@/lib/index-entity';
import { touchEntity } from '@compass/db/touch';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id: noteId } = await params;
    const body = await readJson(req, fileFromInboxSchema);

    const note = await notesQ.getNote(noteId);
    if (!note) throw new ApiError('not_found', 'note not found', 404);

    let target: { type: 'project' | 'learning_goal'; id: string } | null = null;
    if (body.target === 'existing') {
      target = { type: body.target_type, id: body.target_id };
    } else if (body.target === 'new_project') {
      const created = await projectsQ.createProject({ title: body.title });
      await indexProject(created.id);
      target = { type: 'project', id: created.id };
    } else if (body.target === 'new_learning_goal') {
      const created = await learningQ.createLearningGoal({ title: body.title });
      await indexLearningGoal(created.id);
      target = { type: 'learning_goal', id: created.id };
    }

    if (!target) {
      // keep_unfiled_note path: leave the note in the inbox but still record that the user
      // explicitly chose to keep it there. Both an activity_event (via touchEntity, no
      // alsoTouch) and an audit_log row make the decision traceable.
      await touchEntity({
        type: 'note',
        id: noteId,
        event: { type: 'filed', payload: { target: 'kept' } },
      });
      await adminQ.writeAudit({
        actor: auth.principal === 'token' ? 'cli' : 'user',
        action: 'inbox.file',
        entity_type: 'note',
        entity_id: noteId,
        metadata: { target: 'kept' },
      });
      return ok({ note });
    }

    const updated = await notesQ.fileNoteToEntity(noteId, target);
    await indexNote(noteId);
    if (target.type === 'project') await indexProject(target.id);
    else await indexLearningGoal(target.id);

    await adminQ.writeAudit({
      actor: auth.principal === 'token' ? 'cli' : 'user',
      action: 'inbox.file',
      entity_type: 'note',
      entity_id: noteId,
      metadata: { target_type: target.type, target_id: target.id },
    });

    return ok({ note: updated, target });
  } catch (e) {
    return fromApiError(e);
  }
}
