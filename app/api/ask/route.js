// app/api/ask/route.js
//
// "Ask the Word" — global, cross-corpus search. Same retrieval spine as
// series-chat (hybrid RRF search → diversity rerank → grounded, cited answer),
// but UN-scoped: it searches every embedded sermon in the library at once
// instead of a single series. The frontend renders the streamed answer plus a
// numbered "sources" rail built from SEGMENT_MAP.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { voicePromptSection } from '@/lib/voice';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
);

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('WARNING: SUPABASE_SERVICE_KEY not set. RPC calls may fail.');
}

// Diversity-aware rerank over the fused candidate pool. For a cross-corpus
// answer we want breadth — cap how many segments any single sermon contributes
// so the answer draws on multiple messages, then backfill if we come up short.
function rerankSegments(rows, limit = 18, maxPerSermon = 3) {
  const norm = (t) =>
    (t || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

  const seenText = new Set();
  const pickedIds = new Set();
  const perSermon = new Map();
  const out = [];

  for (const r of rows) {
    if (out.length >= limit) break;
    const key = norm(r.text);
    if (seenText.has(key)) continue;
    const count = perSermon.get(r.sermon_id) || 0;
    if (count >= maxPerSermon) continue;
    seenText.add(key);
    perSermon.set(r.sermon_id, count + 1);
    pickedIds.add(r.id);
    out.push(r);
  }

  if (out.length < limit) {
    for (const r of rows) {
      if (out.length >= limit) break;
      if (pickedIds.has(r.id)) continue;
      const key = norm(r.text);
      if (seenText.has(key)) continue;
      seenText.add(key);
      pickedIds.add(r.id);
      out.push(r);
    }
  }

  return out;
}

async function embedText(text) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) throw new Error(`Embed failed: ${await res.text()}`);
  const { embedding } = await res.json();
  return embedding;
}

function plainStreamResponse(text) {
  const encoder = new TextEncoder();
  const body = `SEGMENT_MAP:{}\n${text}`;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

// Cache the full sermon-id list briefly so we don't re-query it on every ask.
// The corpus grows slowly (a few sermons a week), so a short TTL is plenty.
let _idCache = { ids: null, at: 0 };
async function allSermonIds() {
  const now = Date.now();
  if (_idCache.ids && now - _idCache.at < 5 * 60 * 1000) return _idCache.ids;

  const ids = [];
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('sermons')
      .select('id')
      .range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    for (const r of data) ids.push(r.id);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  _idCache = { ids, at: now };
  return ids;
}

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: true, message: 'Message is required' }, { status: 400 });
    }

    // 1. Embed the question (keyword-only fallback if the embed service is down)
    let queryEmbedding = null;
    try {
      queryEmbedding = await embedText(message);
    } catch (embedErr) {
      console.error('[ask] Embed failed:', embedErr.message);
    }
    const embedFailed = !queryEmbedding;

    // 2. Hybrid search across the ENTIRE library (all sermon ids).
    const sermonIds = await allSermonIds();
    let relevantSegments = [];

    if (sermonIds.length > 0) {
      let candidatePool = null;

      const { data: hybrid, error: hybridErr } = await supabaseAdmin.rpc('match_segments_hybrid', {
        query_embedding: queryEmbedding, // may be null → keyword-only
        query_text: message,
        filter_sermon_ids: sermonIds,
        match_count: 60,
      });

      if (hybridErr) {
        console.error('[ask] Hybrid RPC error, falling back to vector-only:', hybridErr.message);
        if (queryEmbedding) {
          const { data: vec, error: vecErr } = await supabaseAdmin.rpc('match_segments_by_sermons', {
            query_embedding: queryEmbedding,
            filter_sermon_ids: sermonIds,
            match_threshold: 0.25,
            match_count: 60,
          });
          if (vecErr) console.error('[ask] Vector fallback RPC error:', vecErr.message);
          else candidatePool = vec;
        }
      } else {
        candidatePool = hybrid;
      }

      if (Array.isArray(candidatePool) && candidatePool.length > 0) {
        relevantSegments = rerankSegments(candidatePool, 18);
      }
    }

    // 3. Nothing grounded → be honest, never fabricate.
    if (relevantSegments.length === 0) {
      console.warn(`[ask] No grounded segments (embedFailed=${embedFailed}). Refusing to fabricate.`);
      const honest = embedFailed
        ? "I'm having trouble reaching the study service right now, so I can't search Rev. Peter's messages for this yet. Please try again in a moment."
        : "I couldn't find where Rev. Peter teaches on that across the messages I have indexed. Try rephrasing, or ask about a related idea — faith, prayer, righteousness, the Holy Spirit, giving, and more are all covered deeply.";
      return plainStreamResponse(honest);
    }

    // 4. Build the numbered segment list + the map the frontend renders as sources.
    const segmentList = relevantSegments
      .map((seg, i) =>
        `[${i + 1}] SERMON:${seg.sermon_title}\n"${seg.text}"`
      )
      .join('\n\n');

    const snippet = (t) =>
      (t || '').length > 300 ? `${t.slice(0, 300).trim()}…` : t || '';

    const segmentMap = relevantSegments.reduce((acc, seg, i) => {
      acc[i + 1] = {
        sermon_id: seg.sermon_id,
        video_id: seg.video_id,
        start_seconds: seg.start_seconds,
        sermon_title: seg.sermon_title,
        text: snippet(seg.text),
      };
      return acc;
    }, {});

    // 5. System prompt — tuned for synthesis ACROSS messages.
    const systemPrompt = `You are a warm, discerning Bible study companion for Heritage of Faith Church. A believer has asked one question, and you are answering it from across the full body of Rev. Peter Ayoalabi's teaching — many different messages at once.

═══════════════════════════════════════
SOURCING — YOUR MOST CRITICAL RULE
═══════════════════════════════════════
- You may ONLY use what is explicitly stated in the transcript segments provided below.
- The segments come from DIFFERENT sermons. Weave them into ONE coherent answer.
- Never add outside theology, generic Christian advice, or anything from your training data.
- If the segments only partially cover the question, answer what they do cover and say plainly what isn't addressed.
- Never invent or assume what Rev. Peter might teach.

═══════════════════════════════════════
CITATION RULES — MANDATORY
═══════════════════════════════════════
- Every factual claim MUST end with [N] matching a segment number.
- When a point is echoed across multiple messages, cite each relevant one, e.g. "...faith comes by hearing [2][7]."
- Only cite segments you actually used. Citations are inline only — no CITATIONS section, no URLs.

═══════════════════════════════════════
RESPONSE SHAPE
═══════════════════════════════════════
- Open with a direct, one-sentence answer to the question.
- Then a few tight paragraphs of flowing prose that develop it, drawing threads from the different messages.
- Prefer Rev. Peter's own phrasing — quote his exact words when they're memorable.
- Refer to him as "Rev. Peter". Warm, faith-filled, never academic or robotic.
- Never say "the transcript says" or "according to the segment" — teach it as living truth.
- Keep it focused; don't pad.

═══════════════════════════════════════
FOLLOW-UP SUGGESTIONS — STRICT
═══════════════════════════════════════
- End with EXACTLY: SUGGESTIONS:["Question one?","Question two?","Question three?"]
- Each suggestion MUST be answerable from the segments you were given — specific, not generic.${voicePromptSection()}`;

    const userMessageWithContext = `TRANSCRIPT SEGMENTS FROM ACROSS REV. PETER'S MESSAGES — USE ONLY THESE:
${segmentList}

QUESTION: ${message}`;

    console.log(`[ask] ${relevantSegments.length} segments (from ${new Set(relevantSegments.map(s => s.sermon_id)).size} sermons) sent to Gemini`);

    // 6. Stream the answer, SEGMENT_MAP header first (same wire format as chat).
    const model = genAI.getGenerativeModel({
      // "-latest" alias — gemini-2.5-flash was retired (404) in mid-2026.
      model: 'gemini-flash-latest',
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContentStream(userMessageWithContext);

    const encoder = new TextEncoder();
    const segmentMapHeader = `SEGMENT_MAP:${JSON.stringify(segmentMap)}\n`;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(segmentMapHeader));
          for await (const chunk of result.stream) {
            const content = chunk.text();
            if (content) controller.enqueue(encoder.encode(content));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[ask] Error:', error);
    return NextResponse.json(
      { error: true, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
