// lib/admin-auth.js
//
// Single-admin gate. One password (ADMIN_PASSWORD) is exchanged for a signed,
// httpOnly session cookie; ADMIN_SESSION_SECRET signs it.
//
// Rules this file exists to enforce:
//  - FAIL CLOSED. If either env var is missing or too short, nobody gets in.
//  - Check auth in every admin page and every /api/admin route handler. Never
//    rely on middleware alone (this app's Next version predates fixes for
//    middleware-bypass bugs, and there is no middleware anyway).
//  - State-changing requests must come from this site (Origin check) on top of
//    the SameSite=Strict cookie.
//
// Server-only: uses Node crypto and next/headers.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'fh_admin';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

const MIN_PASSWORD = 12;
const MIN_SECRET = 32;

const password = () => process.env.ADMIN_PASSWORD || '';
const secret = () => process.env.ADMIN_SESSION_SECRET || '';

/** True only when both env vars are present and long enough to be worth trusting. */
export function adminConfigured() {
  return password().length >= MIN_PASSWORD && secret().length >= MIN_SECRET;
}

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

/** Constant-time password check (hashes both sides so lengths don't leak). */
export function passwordMatches(input) {
  if (!adminConfigured() || typeof input !== 'string' || input.length > 200) return false;
  return crypto.timingSafeEqual(sha(input), sha(password()));
}

// The signing key mixes in the password, so changing either env var signs
// every existing session out.
const sign = (payload) =>
  crypto.createHmac('sha256', `${secret()}\u0000${password()}`).update(payload).digest('base64url');

export function makeSessionToken() {
  const payload = `${Date.now() + SESSION_SECONDS * 1000}.${crypto.randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionTokenValid(token) {
  if (!adminConfigured() || typeof token !== 'string') return false;
  const cut = token.lastIndexOf('.');
  if (cut < 1) return false;

  const payload = token.slice(0, cut);
  const given = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;

  const expires = Number(payload.split('.')[0]);
  return Number.isFinite(expires) && expires > Date.now();
}

/** For server components and route handlers: is this request signed in? */
export function isAdmin() {
  return sessionTokenValid(cookies().get(ADMIN_COOKIE)?.value);
}

/**
 * Call at the top of every admin page AND the console layout. Next keeps a
 * layout mounted while you move between its pages, so a layout-only check does
 * not re-run on client navigation; each page must check for itself.
 */
export function requireAdminPage() {
  if (!adminConfigured() || !isAdmin()) redirect('/admin/login');
}

/** Cookie options shared by login (set) and logout (clear). */
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

/** True when a state-changing request originates from this same site. */
export function sameOrigin(req) {
  try {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    return !!origin && !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Guard for /api/admin route handlers. Returns a NextResponse to send back
 * (not allowed), or null (go ahead):
 *
 *   const denied = adminApiGuard(req);
 *   if (denied) return denied;
 */
export function adminApiGuard(req) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'Admin is not configured on this server.' }, { status: 503 });
  }
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  }
  return null;
}
