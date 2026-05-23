import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import * as authQ from '@compass/db/queries/auth';
import { fromApiError, rateLimit } from '@/lib/api';

const bodySchema = z.object({ scope: z.enum(['cli', 'helper']) });

function gen(len: number) {
  return randomBytes(len).toString('base64url');
}

function userCode(): string {
  // 4-4 alphanumeric without confusable chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () =>
    Array.from(randomBytes(4))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
  return `${pick()}-${pick()}`;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    // Per-IP rate limit so a runaway/abusive client cannot fill `device_code` with junk rows.
    if (!rateLimit(`auth_device:${clientIp(req)}`, 20)) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'too many device-code requests' } },
        { status: 429 },
      );
    }
    const body = bodySchema.parse(await req.json());
    const device_code = gen(32);
    const user_code = userCode();
    await authQ.createDeviceCode({
      device_code,
      user_code,
      scope: body.scope,
      ttl_seconds: 600,
    });
    const baseUrl = process.env.COMPASS_BASE_URL ?? `http://localhost:3000`;
    return NextResponse.json({
      device_code,
      user_code,
      verification_url: `${baseUrl}/auth/device?code=${user_code}`,
      expires_in: 600,
      interval: 5,
    });
  } catch (e) {
    return fromApiError(e);
  }
}
