import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import * as authQ from '@compass/db/queries/auth';
import { ApiError } from '@compass/shared';
import { fromApiError, rateLimit } from '@/lib/api';

const bodySchema = z.object({ device_code: z.string().min(8).max(128) });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    // Per-IP rate limit so a misconfigured client can't flood the endpoint.
    if (!rateLimit(`auth_poll:${clientIp(req)}`, 60)) {
      throw new ApiError('rate_limited', 'too many polls', 429);
    }
    const body = bodySchema.parse(await req.json());
    const dc = await authQ.getDeviceCode(body.device_code);
    if (!dc) {
      return NextResponse.json({ status: 'denied' });
    }
    if (dc.denied) return NextResponse.json({ status: 'denied' });
    if (!dc.approved || !dc.token_id) {
      return NextResponse.json({ status: 'pending' });
    }
    // The plain token is briefly stashed in device_code.token_id during approval. We return it
    // exactly once, then immediately delete the row so the secret has no DB persistence beyond
    // the polling window.
    const plainToken = dc.token_id;
    await authQ.deleteDeviceCode(body.device_code);
    return NextResponse.json({ status: 'approved', token: plainToken });
  } catch (e) {
    return fromApiError(e);
  }
}
