import type { NextRequest } from 'next/server';
import { captureRequestSchema } from '@compass/shared/zod';
import * as capturesQ from '@compass/db/queries/captures';
import * as notesQ from '@compass/db/queries/notes';
import * as adminQ from '@compass/db/queries/admin';
import { err, fromApiError, ok, rateLimit, readJson, requireAuth } from '@/lib/api';
import { indexNote } from '@/lib/index-entity';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await readJson(req, captureRequestSchema);
    const key = auth.principal === 'token' ? `tok:${auth.token_id}` : `usr:${auth.user_id}`;
    if (!rateLimit(`capture:${key}`, 120)) {
      return err('rate_limited', 'too many captures', 429);
    }
    const result = await capturesQ.createCapture(body);
    await indexNote(result.note_id);
    const note = await notesQ.getNote(result.note_id);
    await adminQ.writeAudit({
      actor: auth.principal === 'token' ? 'cli' : 'user',
      action: 'capture.create',
      entity_type: 'note',
      entity_id: result.note_id,
      metadata: { duplicate: result.duplicate, body_len: body.body.length },
    });
    return ok({ note, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (e) {
    return fromApiError(e);
  }
}
