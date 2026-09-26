import { NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  ADMIN_COOKIE,
  SESSION_SECONDS,
  adminConfigured,
  cookieOptions,
  makeSessionToken,
  passwordMatches,
  sameOrigin,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'Admin is not configured on this server.' }, { status: 503 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  }

  // Five wrong guesses per 15 minutes per IP. Counted before checking the password.
  const rl = await rateLimit(req, { max: 5, windowMs: 15 * 60_000, prefix: 'admin-login' });
  if (!rl.allowed) return rateLimitResponse(rl);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!passwordMatches(body?.password)) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeSessionToken(), { ...cookieOptions(), maxAge: SESSION_SECONDS });
  return res;
}
