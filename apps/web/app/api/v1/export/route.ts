import { fromApiError, requireAuth } from '@/lib/api';
import { getDb } from '@compass/db';
import { ApiError } from '@compass/shared';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    // Full DB export is a sensitive operation — only allow it from an interactive logged-in
    // user session, never from a CLI / helper / webhook bearer token.
    if (auth.principal !== 'user') {
      throw new ApiError('forbidden', 'export requires a user session', 403);
    }
    const handle = getDb();
    const dump: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      dialect: handle.dialect,
      schema_version: 1,
      tables: {},
    };
    const t = handle.schema;
    const tables = [
      ['project', t.project],
      ['learning_goal', t.learning_goal],
      ['note', t.note],
      ['milestone', t.milestone],
      ['checklist_item', t.checklist_item],
      ['resource', t.resource],
      ['build_run', t.build_run],
      ['activity_event', t.activity_event],
      ['tag', t.tag],
      ['tagging', t.tagging],
      ['settings', t.settings],
      ['notifications', t.notifications],
      ['stall_alerts', t.stall_alerts],
      ['webhook_deliveries', t.webhook_deliveries],
      ['audit_log', t.audit_log],
    ] as const;
    const tablesOut = dump.tables as Record<string, unknown>;
    for (const [name, tbl] of tables) {
      const rows = await handle.db.select().from(tbl as never);
      tablesOut[name] = rows;
    }
    const filename = `compass-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(dump, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return fromApiError(e);
  }
}
