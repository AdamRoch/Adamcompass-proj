import { fromApiError, rateLimit } from '@/lib/api';
import * as authQ from '@compass/db/queries/auth';
import { ApiError } from '@compass/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
    if (!dc.approved || !dc.pending_plain_token) {
      return NextResponse.json({ status: 'pending' });
    }
    // The plain token is briefly stashed in device_code.pending_plain_token during approval.
    // We return it exactly once, then immediately delete the row so the secret has no DB
    // persistence beyond the polling window.
    const plainToken = dc.pending_plain_token;
    await authQ.deleteDeviceCode(body.device_code);
    return NextResponse.json({ status: 'approved', token: plainToken });
  } catch (e) {
    return fromApiError(e);
  }
}
