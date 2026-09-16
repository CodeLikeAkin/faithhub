// lib/rate-limit.js
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

//
// Two-tier rate limiter for the AI-backed API routes (ask, declarations,
// series-chat, series-summary). Each of these calls a paid LLM (Gemini or
// Groq) and/or the embed edge function, so unbounded requests directly cost
// money and can exhaust the free-tier Supabase connection pool.
//
// Tier 1 — PER-DEVICE (primary limit). Keyed by an anonymous id the browser
// sends in X-Client-Id (see lib/client-id.js), generated once and cached in
// localStorage. This is the limit that actually matters for a real visitor.
//
// Tier 2 — PER-IP (backstop, looser). Keyed by IP, ceiling is a multiple of
// the per-device max. Without it, a script could dodge Tier 1 by minting a
// fresh client id per request. With it, one church WiFi network (one IP,
// many real devices) still gets room to breathe — it's not a hard cap on
// the building, just a ceiling far above what genuine traffic should ever
// reach. This is not bot-proof (no free mechanism is); it just raises the
// bar past "trivial single-IP abuse".
//
// Backed by Upstash Redis (shared, durable across serverless instances) when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set. Falls back to
// the previous in-memory, per-instance limiter otherwise — e.g. local dev,
// or before Upstash is provisioned — so the app never hard-fails on a
// missing env var. Call sites (`await rateLimit(req, opts)`) don't change
// either way.
//

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash ? Redis.fromEnv() : null;

// One Ratelimit instance per distinct (prefix, max, windowMs) combo, reused
// across requests/instances-in-warm-state rather than rebuilt every call.
const upstashLimiters = new Map();
function getUpstashLimiter(prefix, max, windowMs) {
  const key = `${prefix}:${max}:${windowMs}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${Math.max(1, Math.round(windowMs / 1000))} s`),
      prefix: `faithhub:${prefix}`,
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// ---- In-memory fallback (fixed-window, per-instance — unchanged behavior
// from before, just factored out so both tiers can share it) --------------
const buckets = new Map(); // key -> { count, resetAt }

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000);
sweeper.unref?.();

function memoryLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }
  if (entry.count >= max) {
    return { allowed: false, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, resetAt: entry.resetAt };
}

function getClientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Per-IP ceiling = per-device max * this multiplier. Generous enough that a
// room full of real devices on one WiFi network doesn't collide with it;
// still a real ceiling for a naive client-id-rotating script.
const IP_BACKSTOP_MULTIPLIER = 12;

/**
 * @param {Request} req
 * @param {{ max: number, windowMs: number, prefix: string }} opts
 * @returns {Promise<{ allowed: boolean, resetAt: number }>}
 */
export async function rateLimit(req, { max, windowMs, prefix }) {
  const ip = getClientIp(req);
  const clientId = req.headers.get('x-client-id') || null;
  // No client id (private browsing, localStorage blocked, etc.) → the
  // device bucket collapses to the IP bucket, same as the old behavior.
  const deviceKey = clientId ? `dev:${clientId}` : `ip:${ip}`;
  const ipKey = `ipcap:${ip}`;
  const ipMax = max * IP_BACKSTOP_MULTIPLIER;

  if (hasUpstash) {
    try {
      const deviceResult = await getUpstashLimiter(prefix, max, windowMs).limit(deviceKey);
      if (!deviceResult.success) {
        return { allowed: false, resetAt: deviceResult.reset };
      }
      if (clientId) {
        const ipResult = await getUpstashLimiter(`${prefix}:ipcap`, ipMax, windowMs).limit(ipKey);
        if (!ipResult.success) {
          return { allowed: false, resetAt: ipResult.reset };
        }
      }
      return { allowed: true, resetAt: deviceResult.reset };
    } catch (err) {
      console.error('[rate-limit] Upstash error, failing open to in-memory limiter:', err.message);
      // fall through to the memory limiter below rather than blocking everyone
    }
  }

  const deviceResult = memoryLimit(`${prefix}:${deviceKey}`, max, windowMs);
  if (!deviceResult.allowed) return deviceResult;
  if (clientId) {
    const ipResult = memoryLimit(`${prefix}:${ipKey}`, ipMax, windowMs);
    if (!ipResult.allowed) return ipResult;
  }
  return deviceResult;
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
