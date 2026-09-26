import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, cookieOptions, sameOrigin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return res;
}
