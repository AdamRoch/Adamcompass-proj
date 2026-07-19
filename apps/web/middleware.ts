import { type NextRequest, NextResponse } from 'next/server';

// Minimal middleware. Heavy auth lives in route handlers (need DB access, which middleware can't do).
// This just handles request-id and a basic CORS shape for the webhook endpoint.

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const reqId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  res.headers.set('x-request-id', reqId);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
