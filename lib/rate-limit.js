// lib/rate-limit.js
import { NextResponse } from 'next/server';

//
// In-memory, per-IP rate limiter for the AI-backed API routes (ask,
// declarations, series-chat, series-summary). Each of these calls a paid
// LLM (Gemini or Groq) and/or the embed edge function, so an unbounded
// script loop directly costs money and can exhaust the free-tier Supabase
// connection pool.
//
// This is a stopgap, not a hardened defense: counters live in the memory of
// whichever serverless instance handles the request, so they reset on cold
// start and aren't shared across concurrent instances/regions. It stops
// naive scripted abuse from a single client; it will NOT hold up against a
// distributed or highly parallel attacker. Swap in Upstash Redis
// (`@upstash/ratelimit`) for a real shared counter when that's set up —
// this module's call sites (`rateLimit(req, opts)`) won't need to change.

const buckets = new Map(); // key -> { count, resetAt }

// Periodic sweep so `buckets` doesn't grow unbounded over the life of a
// warm instance. Unref'd so it never keeps the process alive on its own.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000);
sweeper.unref?.();

function getClientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Fixed-window rate limit keyed by client IP.
 * @param {Request} req
 * @param {{ max: number, windowMs: number, prefix: string }} opts
 * @returns {{ allowed: boolean, remaining: number, resetAt: number, ip: string }}
 */
export function rateLimit(req, { max, windowMs, prefix }) {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt, ip };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, ip };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt, ip };
}

/** Standard 429 JSON response the frontends already know how to surface via `!res.ok`. */
export function rateLimitResponse(rl) {
  const retryAfterSeconds = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: true,
      message: "You're sending requests a bit fast — please wait a moment and try again.",
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  );
}
