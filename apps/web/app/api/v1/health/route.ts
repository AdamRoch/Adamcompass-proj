import { ok } from '@/lib/api';
import { getDb } from '@compass/db';

export async function GET() {
  const handle = getDb();
  return ok({
    ok: true,
    dialect: handle.dialect,
    server_time: new Date().toISOString(),
    version: '0.1.0',
  });
}
