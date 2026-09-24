// app/api/search/route.js
//
// Library search — "search all messages" behind the box on /series.
//
// Title matching happens on the client (it already holds every sermon, so it's
// instant and free). This route is the other half: searching what was actually
// *said*, across the entire corpus, so a search for "forgiveness" finds the
// message that spends forty minutes on it without the word in its title.
//
// Same retrieval contract as /api/ask — embed the query, then the hybrid RRF
// RPC — because a person typing into a search box is asking a freeform
// question, and ilike/contains would only ever find literal substrings. Scope
// is deliberately the WHOLE corpus, including the sermons the catalog hides:
// not being curated into a series is no reason to be unfindable.
//
// No LLM is involved. This ranks and returns; it does not answer.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const MAX_QUERY_LENGTH = 200;
// Deliberately smaller than /api/ask's 60. That route runs once per question
// and its cost is hidden inside a Gemini answer; this one runs on a debounced
// keystroke and the person is staring at an empty results list. On free-tier
// Postgres a global hybrid fuse over 60 candidates was taking 8-13s and
// sometimes tripping the statement timeout outright.
const CANDIDATE_SEGMENTS = 30; // segment rows pulled before grouping by sermon
const MAX_RESULTS = 20; // messages returned
const SNIPPET_CHARS = 260;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function embedText(text) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${await res.text()}`);
  const { embedding } = await res.json();
  return embedding;
}

/**
 * A readable extract of the segment: centred on the first query word that
 * actually appears, so a keyword hit is visible rather than buried 300
 * characters in. Falls back to the head of the segment for a purely semantic
 * match, where there's no literal word to centre on.
 */
function snippet(text, query) {
  const full = (text || '').replace(/\s+/g, ' ').trim();
  if (full.length <= SNIPPET_CHARS) return full;

  const words = query
    .toLowerCase()
    .split(/[^\w']+/)
    .filter((w) => w.length > 3);
  const lower = full.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }

  if (at === -1) return `${full.slice(0, SNIPPET_CHARS).trimEnd()}…`;

  // Back up to a word boundary so the extract doesn't start mid-word.
  let start = Math.max(0, at - Math.floor(SNIPPET_CHARS / 3));
  if (start > 0) {
    const space = full.indexOf(' ', start);
    start = space === -1 ? start : space + 1;
  }
  const end = Math.min(full.length, start + SNIPPET_CHARS);
  return `${start > 0 ? '…' : ''}${full.slice(start, end).trim()}${end < full.length ? '…' : ''}`;
}

export async function POST(req) {
  // Looser than the LLM routes — this costs an embed call and one RPC, not a
  // Gemini prompt — but still bounded: it's reachable by anyone, and every
  // keystroke past the debounce is a request.
  const rl = await rateLimit(req, { max: 30, windowMs: 60_000, prefix: 'search' });
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { q } = await req.json();

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }
    if (q.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: true, message: 'That search is too long.' },
        { status: 400 }
      );
    }

    const query = q.trim();

    // Embedding is best-effort: without it the RPC still runs its full-text
    // leg, which degrades to keyword search rather than failing outright.
    const t0 = Date.now();
    let queryEmbedding = null;
    try {
      queryEmbedding = await embedText(query);
    } catch (err) {
      console.error('[search] Embed failed, keyword-only:', err.message);
    }
    const tEmbed = Date.now();

    let rows = null;
    const { data: hybrid, error: hybridErr } = await supabaseAdmin.rpc('match_segments_hybrid', {
      query_embedding: queryEmbedding,
      query_text: query,
      match_count: CANDIDATE_SEGMENTS,
    });

    if (hybridErr) {
      console.error('[search] Hybrid RPC error, falling back to vector-only:', hybridErr.message);
      if (queryEmbedding) {
        const { data: vec, error: vecErr } = await supabaseAdmin.rpc('match_segments_by_sermons', {
          query_embedding: queryEmbedding,
          match_threshold: 0.25,
          match_count: CANDIDATE_SEGMENTS,
        });
        if (vecErr) {
          console.error('[search] Vector fallback failed:', vecErr.message);
          return NextResponse.json(
            { error: true, message: 'Search is unavailable just now.' },
            { status: 503 }
          );
        }
        rows = vec;
      } else {
        return NextResponse.json(
          { error: true, message: 'Search is unavailable just now.' },
          { status: 503 }
        );
      }
    } else {
      rows = hybrid;
    }

    // One row per message: the best-scoring segment becomes its snippet and
    // its "jump to this moment" timestamp. Rows arrive ranked, so the first
    // time we see a sermon is already its best segment.
    const bySermon = new Map();
    for (const r of rows || []) {
      if (!r.sermon_id || bySermon.has(r.sermon_id)) continue;
      bySermon.set(r.sermon_id, {
        sermonId: r.sermon_id,
        title: r.sermon_title || '',
        videoId: r.video_id || null,
        startSeconds: Number.isFinite(r.start_seconds) ? r.start_seconds : null,
        snippet: snippet(r.text, query),
      });
    }

    console.log(`[search] "${query}" embed=${tEmbed - t0}ms rpc=${Date.now() - tEmbed}ms hits=${bySermon.size}`);
    return NextResponse.json({ results: [...bySermon.values()].slice(0, MAX_RESULTS) });
  } catch (err) {
    console.error('[search] Unexpected error:', err);
    return NextResponse.json(
      { error: true, message: 'Search is unavailable just now.' },
      { status: 503 }
    );
  }
}
