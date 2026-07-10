// app/api/series-chat/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { voicePromptSection } from '@/lib/voice';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Diversity-aware rerank over the fused (retrieve-more) candidate pool.
// Rows arrive already ordered by hybrid score. We (a) drop near-duplicate text,
// and (b) cap how many segments any one sermon may contribute so a single
// message can't monopolize the context — then, if still short, fill the rest
// ignoring the cap so we don't starve single-sermon answers.
function rerankSegments(rows, limit = 15, maxPerSermon = 4) {
  const norm = (t) =>
    (t || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

  const seenText = new Set();
  const pickedIds = new Set();
  const perSermon = new Map();
  const out = [];

  // Pass 1 — diversity-capped
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

  // Pass 2 — fill remaining slots, ignoring the per-sermon cap
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

// Admin Supabase client for RPC calls (requires service key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Validate service key is available
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('WARNING: SUPABASE_SERVICE_KEY not set. RPC calls may fail.');
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

// Stream a plain assistant message (with an empty segment map) using the same
// wire format the frontend already parses. Used when we have no grounded
// segments and refuse to fabricate an answer.
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
  try {
    const { seriesId, sermonId, message, chatHistory } = await req.json();

    // Validate inputs
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: true, message: 'Message is required and cannot be empty' }, { status: 400 });
    }

    if ((!seriesId || typeof seriesId !== 'string') && (!sermonId || typeof sermonId !== 'string')) {
      return NextResponse.json({ error: true, message: 'A seriesId or sermonId is required' }, { status: 400 });
    }

    // Scope of this study session: a single sermon (sermonId wins) or the whole
    // series. When scoped to one sermon we retrieve only from that sermon and
    // tell the model it is studying a single message, not a series.
    const singleSermon = !!(sermonId && typeof sermonId === 'string');

    let scopeTitle = '';
    let sermonIds = [];
    let overviewText = '';

    if (singleSermon) {
      // 1a. Fetch the single sermon's metadata
      const { data: sermon, error: sermonError } = await supabaseAdmin
        .from('sermons')
        .select('id, title, youtube_video_id')
        .eq('id', sermonId)
        .single();

      if (sermonError || !sermon) {
        return NextResponse.json({ error: true, message: 'Sermon not found' }, { status: 404 });
      }

      scopeTitle = sermon.title;
      sermonIds = [sermon.id];
      overviewText = `SERMON: ${sermon.title}`;
    } else {
      // 1b. Fetch series + sermon metadata
      const { data: series, error: seriesError } = await supabaseAdmin
        .from('series')
        .select(`
          title,
          series_sermons (
            part_number,
            sermons (
              id,
              title,
              youtube_video_id
            )
          )
        `)
        .eq('id', seriesId)
        .single();

      if (seriesError || !series) {
        return NextResponse.json({ error: true, message: 'Series not found' }, { status: 404 });
      }

      const sortedSermons = series.series_sermons
        .sort((a, b) => a.part_number - b.part_number)
        .map((ss) => ss.sermons);

      scopeTitle = series.title;
      sermonIds = sortedSermons.map((s) => s?.id).filter(Boolean);
      overviewText = `SERMON SERIES: ${series.title}
Parts: ${sortedSermons.map((s, i) => `Part ${i + 1} — ${s.title}`).join(', ')}`;
    }

    // 2. Embed user question
    let queryEmbedding = null;
    try {
      queryEmbedding = await embedText(message);
    } catch (embedErr) {
      console.error('[chat] Embed failed:', embedErr.message);
    }
    const embedFailed = !queryEmbedding;

    // 3. Hybrid segment search (semantic + keyword, RRF-fused), scoped by the
    //    series' sermon_ids rather than sermon_segments.series_id (only partially
    //    populated). We retrieve a wide pool (40), then rerank down to 15 for
    //    diversity. If the embed service is down, queryEmbedding is null and the
    //    hybrid RPC degrades to keyword-only instead of returning nothing.
    let relevantSegments = [];
    if (sermonIds.length > 0 && (queryEmbedding || message.trim())) {
      let candidatePool = null;

      const { data: hybrid, error: hybridErr } = await supabaseAdmin.rpc('match_segments_hybrid', {
        query_embedding: queryEmbedding, // may be null → keyword-only
        query_text: message,
        filter_sermon_ids: sermonIds,
        match_count: 40,
      });

      if (hybridErr) {
        // Hybrid RPC not present yet (migration not applied) or failed — fall
        // back to the vector-only RPC when we have an embedding.
        console.error('[chat] Hybrid RPC error, falling back to vector-only:', hybridErr.message);
        if (queryEmbedding) {
          const { data: vec, error: vecErr } = await supabaseAdmin.rpc('match_segments_by_sermons', {
            query_embedding: queryEmbedding,
            filter_sermon_ids: sermonIds,
            match_threshold: 0.25,
            match_count: 40,
          });
          if (vecErr) console.error('[chat] Vector fallback RPC error:', vecErr.message);
          else candidatePool = vec;
        }
      } else {
        candidatePool = hybrid;
      }

      if (Array.isArray(candidatePool) && candidatePool.length > 0) {
        // Single-sermon study: drop the per-sermon diversity cap (there is only
        // one sermon, so capping at 4 would needlessly reshuffle the best hits).
        relevantSegments = rerankSegments(candidatePool, 15, singleSermon ? 15 : 4);
      }
    }

    // 4. No grounded segments → be honest instead of fabricating.
    //    Previously this fell back to raw chronological transcript chunks, which
    //    surfaced worship intros / "[Music]" filler and let the model answer from
    //    non-teaching content with no visible failure. We now refuse rather than
    //    mislead: either the study service is down, or this series' segments have
    //    not been embedded yet (run backfill-embeddings.js to fix the latter).
    if (relevantSegments.length === 0) {
      console.warn(`[chat] No grounded segments for ${singleSermon ? `sermon ${sermonId}` : `series ${seriesId}`} (embedFailed=${embedFailed}). Refusing to fabricate.`);
      const honestMessage = embedFailed
        ? "I'm having trouble reaching the study service right now, so I can't pull up Rev. Peter's exact teaching for this question yet. Please try again in a moment."
        : `I don't yet have Rev. Peter's teaching from “${scopeTitle}” indexed for deep study, so I can't ground an answer in his exact words here. You can still watch ${singleSermon ? 'this message' : 'the messages'} directly while ${singleSermon ? 'it is' : 'this series is'} being prepared.`;
      return plainStreamResponse(honestMessage);
    }

    // 5. Build segment index — pass video_id and start_seconds explicitly
    const segmentList = relevantSegments
      .map((seg, i) =>
        `[${i + 1}] VIDEO_ID:${seg.video_id} | TIME:${seg.start_seconds} | SERMON:${seg.sermon_title}
"${seg.text}"`
      )
      .join('\n\n');

    // 6. Pass segment map as JSON so frontend can build YouTube links
    const segmentMap = relevantSegments.reduce((acc, seg, i) => {
      acc[i + 1] = {
        video_id: seg.video_id,
        start_seconds: seg.start_seconds,
        sermon_title: seg.sermon_title,
        text: seg.text.substring(0, 80),
      };
      return acc;
    }, {});

    // 7. Improved system prompt
    const systemPrompt = `You are a warm, knowledgeable Bible study companion for Heritage of Faith Church. You help believers study the exact teachings of Rev. Peter Ayoalabi from this ${singleSermon ? 'message' : 'sermon series'}.

═══════════════════════════════════════
SOURCING — YOUR MOST CRITICAL RULE
═══════════════════════════════════════
- You may ONLY use what is explicitly stated in the transcript segments provided
- Never add outside theology, generic Christian advice, or anything from your training data
- If the question is not covered in the segments, say warmly:
  "Rev. Peter doesn't address that specific point in these segments. What he does teach here is: [cite what's actually there]"
- Never invent or assume what Rev. Peter might teach

═══════════════════════════════════════
CITATION RULES — MANDATORY
═══════════════════════════════════════
- Every factual claim MUST end with [N] matching a segment number
- Use the exact segment numbers from the provided list [1], [2], [3] etc.
- Only cite segments you actually used — do not cite a segment just to have a citation
- Do NOT include a CITATIONS section at the end — citations are inline only [N]
- Do NOT write URLs — the frontend builds the links from segment numbers

═══════════════════════════════════════
RESPONSE FORMAT — READ CAREFULLY
═══════════════════════════════════════
- Match your format to the question:
  • Simple/direct question → 2-4 sentences of flowing prose, no headings, no bullets
  • Complex/multi-part question → prose paragraphs with occasional bold for emphasis
  • "List" or "what are the ways" questions → only then use a short list
- NEVER default to bullet points for everything
- NEVER use rigid "heading + 3 bullets" structure on every answer
- Write like a thoughtful study companion who has read these transcripts deeply
- Keep answers focused — don't pad to fill space

═══════════════════════════════════════
VOICE & TONE
═══════════════════════════════════════
- Mirror Rev. Peter's own phrases and language from the segments
- Quote his exact words directly and often — prefer his phrasing over paraphrase.
  When he says something memorably, put it in his words, not yours.
- Warm, faith-filled, conversational — not academic or robotic
- Never say "the transcript says" or "according to the segment" — teach it as living truth
- Refer to the pastor as "Rev. Peter" always

═══════════════════════════════════════
FOLLOW-UP SUGGESTIONS — STRICT RULES
═══════════════════════════════════════
- At the very end of your response, output exactly this format:
  SUGGESTIONS:["Question one?","Question two?","Question three?"]
- CRITICAL: Every suggestion MUST be directly answerable from the segments you were given
- Read the segments first — then generate questions only about what's actually there
- Never suggest questions about topics not present in the provided segments
- Do not generate generic Christian questions — they must be specific to this ${singleSermon ? 'message' : 'series'}${voicePromptSection()}`;

    // 8. Build conversation history
    const conversationHistory = (chatHistory || [])
      .map((m) => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text || m.content || '' }],
      }))
      .filter((m) => m.parts[0].text.trim() !== '')
      .slice(-6);

    // 9. User message with segments
    const userMessageWithContext = `${overviewText}

TRANSCRIPT SEGMENTS — USE ONLY THESE:
${segmentList}

QUESTION: ${message}`;

    console.log(`[chat] ${relevantSegments.length} segments sent to Gemini`);

    // 10. Call Gemini with streaming
    const model = genAI.getGenerativeModel({
      // "-latest" alias — gemini-2.5-flash was retired (404) in mid-2026.
      model: 'gemini-flash-latest',
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({ history: conversationHistory });
    const result = await chat.sendMessageStream(userMessageWithContext);

    // 11. Stream back — prepend segment map as first line for frontend
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
    console.error('[chat] Error:', error);
    return NextResponse.json(
      { error: true, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}