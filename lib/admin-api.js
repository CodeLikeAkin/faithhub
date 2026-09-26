// lib/admin-api.js
//
// Shared pieces for the /api/admin route handlers: JSON replies, a bounded
// body reader, the change-history writer and the query-time embedder.
// Server-only. Every route still calls adminApiGuard() first.

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin-db';

export const ok = (data = { ok: true }, status = 200) => NextResponse.json(data, { status });
export const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Parse a JSON body, refusing anything over `maxBytes` (admin payloads are small). */
export async function readJson(req, maxBytes = 200_000) {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('Request too large.');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Bad request.');
  }
}

/**
 * Record one admin change in admin_audit (before/after snapshots). Never
 * throws: a failed history write must not undo or block the edit itself, but
 * it is logged so it can be noticed.
 */
export async function audit({ action, entity, entityId = null, summary, before = null, after = null }) {
  try {
    const { error } = await adminDb()
      .from('admin_audit')
      .insert([{ action, entity, entity_id: entityId ? String(entityId) : null, summary, before, after }]);
    if (error) console.error('[admin-audit] write failed:', error.message);
  } catch (e) {
    console.error('[admin-audit] write failed:', e.message);
  }
}

/**
 * gte-small, 384-dim, via the same `embed` edge function every search route
 * uses (CLAUDE.md rule 3). Used when an admin edits a declaration's wording,
 * so Declarations search keeps finding it.
 */
export async function embedText(text) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status}).`);
  const { embedding } = await res.json();
  if (!Array.isArray(embedding) || embedding.length !== 384) throw new Error('Embedding came back malformed.');
  return embedding;
}

/** Turn a thrown error into a reply without leaking internals. */
export function failFrom(e, fallback = 'Something went wrong. Try again.') {
  const msg = e?.message || '';
  if (/Request too large|Bad request/.test(msg)) return fail(msg, 400);
  console.error('[admin]', msg);
  return fail(fallback, 500);
}
