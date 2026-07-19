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
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { streamGroqAnswer, isGeminiQuotaError } from '@/lib/groq';

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

export async function POST(req) {
  const rl = rateLimit(req, { max: 8, windowMs: 60_000, prefix: 'ask' });
  if (!rl.allowed) return rateLimitResponse(rl);

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

    // 2. Hybrid search across the ENTIRE library. filter_sermon_ids is
    //    omitted (null) — this is a global search by definition, and a filter
    //    listing every sermon in the corpus wouldn't exclude anything, so we
    //    let the RPC skip that clause entirely (see hybrid_search.sql).
    let relevantSegments = [];
    let candidatePool = null;

    const { data: hybrid, error: hybridErr } = await supabaseAdmin.rpc('match_segments_hybrid', {
      query_embedding: queryEmbedding, // may be null → keyword-only
      query_text: message,
      match_count: 60,
    });

    if (hybridErr) {
      console.error('[ask] Hybrid RPC error, falling back to vector-only:', hybridErr.message);
      if (queryEmbedding) {
        const { data: vec, error: vecErr } = await supabaseAdmin.rpc('match_segments_by_sermons', {
          query_embedding: queryEmbedding,
          match_threshold: 0.25,
          match_count: 60,
        });
        if (vecErr) console.error('[ask] Vector fallback RPC error:', vecErr.message);
        else candidatePool = vec;
      }
    } else {
      candidatePool = hybrid;
    }

    // `similarity` from match_segments_hybrid is an RRF positional score
    // (1/(rrf_k+rank)) — every query gets a nonzero "rank 1", including
    // gibberish, so it can't tell us whether anything is actually relevant.
    // `vec_similarity` (added by hybrid_search.sql) is real cosine similarity
    // from the semantic leg; 0 means the row only matched via full-text
    // keyword search (a genuine token match, always trusted — e.g. an exact
    // scripture reference).
    //
    // CALIBRATION NOTE: gte-small's cosine similarities are anisotropic for
    // this corpus — everything sits in a compressed high band regardless of
    // topical relevance. Measured on-topic queries scored 0.863–0.912;
    // measured off-topic/gibberish queries scored 0.765–0.857. The gap is
    // razor-thin (~0.006) and not safe to use as a hard reject line — a
    // precise cutoff there is overfit to a handful of samples and risks
    // wrongly rejecting real, sparsely-worded questions. So this floor is
    // deliberately conservative: it only drops the clearest noise (bare
    // keyboard-mash, wholly unrelated general trivia), not edge cases like
    // "cryptocurrency investing" — those are left to the prompt, which
    // already handles them correctly (see WEAK GROUNDING instruction below
    // and the 20-question case study). Rows from the vector-only fallback
    // RPC are already thresholded server-side and have no vec_similarity
    // field, so they pass through untouched.
    const MIN_VEC_SIMILARITY = 0.8;
    // Separate, higher bar used only to flag weak grounding to the prompt
    // (never to filter) — roughly the floor of the on-topic calibration band.
    const CONFIDENT_VEC_SIMILARITY = 0.86;
    let weakGrounding = false;
    if (Array.isArray(candidatePool) && candidatePool.length > 0) {
      const grounded = candidatePool.filter((r) => {
        if (r.vec_similarity === undefined) return true; // vector-only fallback, already thresholded
        return r.vec_similarity === 0 || r.vec_similarity >= MIN_VEC_SIMILARITY;
      });
      relevantSegments = rerankSegments(grounded, 18);
      weakGrounding =
        relevantSegments.length > 0 &&
        !relevantSegments.some(
          (r) =>
            r.vec_similarity === undefined ||
            r.vec_similarity === 0 ||
            r.vec_similarity >= CONFIDENT_VEC_SIMILARITY
        );
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
${weakGrounding ? `
═══════════════════════════════════════
WEAK GROUNDING — THIS QUESTION
═══════════════════════════════════════
- None of the segments below are a confident, on-topic match for this question — they're the closest the search found, but the connection is loose.
- Say plainly, in one or two sentences, that Rev. Peter's messages don't clearly address this. Do this FIRST, before anything else.
- Do not pad the answer with paragraphs stitched from these loosely-related segments just to seem thorough. If one segment is genuinely worth a short mention after the disclaimer, fine — otherwise stop there.
` : ''}
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

    // Gemini can reject here (429 quota, 503 overload) before any streaming
    // starts — that's exactly what we saw during testing. A 429 is purely a
    // Gemini-side capacity issue, so we retry the same prompt on Groq instead
    // of failing the request. Anything else (bad request, network) would fail
    // the same way on Groq, so we still answer honestly for those.
    let result;
    let useGroqFallback = false;
    try {
      result = await model.generateContentStream(userMessageWithContext);
    } catch (genErr) {
      console.error('[ask] Gemini generateContentStream failed:', genErr.message);
      if (isGeminiQuotaError(genErr)) {
        console.warn('[ask] Gemini quota exhausted — falling back to Groq');
        useGroqFallback = true;
      } else {
        return plainStreamResponse(
          "The study service is busier than usual right now — please try that question again in a moment."
        );
      }
    }

    const encoder = new TextEncoder();
    const segmentMapHeader = `SEGMENT_MAP:${JSON.stringify(segmentMap)}\n`;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(segmentMapHeader));
          if (useGroqFallback) {
            for await (const content of streamGroqAnswer({
              systemPrompt,
              userMessage: userMessageWithContext,
            })) {
              controller.enqueue(encoder.encode(content));
            }
          } else {
            for await (const chunk of result.stream) {
              const content = chunk.text();
              if (content) controller.enqueue(encoder.encode(content));
            }
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
