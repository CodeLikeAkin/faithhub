// app/api/series-chat/route.js

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

export async function POST(req) {
  try {
    const { seriesId, message, chatHistory } = await req.json();

    // 1. Fetch series + sermon metadata
    const { data: series, error: seriesError } = await supabase
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

    // 2. Embed user question
    let queryEmbedding = null;
    try {
      queryEmbedding = await embedText(message);
    } catch (embedErr) {
      console.error('[chat] Embed failed:', embedErr.message);
    }

    // 3. Semantic segment search
    let relevantSegments = [];
    if (queryEmbedding) {
      const { data: segments, error: segErr } = await supabase.rpc('match_segments', {
        query_embedding: queryEmbedding,
        filter_series_id: seriesId,
        match_threshold: 0.25,
        match_count: 15,
      });
      if (segErr) {
        console.error('[chat] Segment RPC error:', segErr.message);
      } else {
        relevantSegments = segments || [];
      }
    }

    // 4. Fallback if no embedded segments yet
    if (relevantSegments.length === 0) {
      console.warn('[chat] No embedded segments, using fallback.');
      const { data: sermonData } = await supabase
        .from('sermons')
        .select('id, title, youtube_video_id, transcript_segments')
        .in('id', sortedSermons.map((s) => s.id));

      const MAX_PER_SERMON = Math.ceil(15 / (sermonData?.length || 1));
      relevantSegments = (sermonData || []).flatMap((sermon) =>
        (sermon.transcript_segments || [])
          .filter(seg => seg.text && seg.text.trim().split(' ').length >= 15)
          .slice(0, MAX_PER_SERMON)
          .map((seg, i) => ({
            id: `${sermon.id}-${i}`,
            sermon_id: sermon.id,
            text: seg.text,
            start_seconds: Math.floor(seg.start_seconds || 0),
            sermon_title: sermon.title,
            video_id: sermon.youtube_video_id,
            similarity: 0,
          }))
      );
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

    const seriesOverview = `SERMON SERIES: ${series.title}
Parts: ${sortedSermons.map((s, i) => `Part ${i + 1} — ${s.title}`).join(', ')}`;

    // 7. Improved system prompt
    const systemPrompt = `You are a warm, knowledgeable Bible study companion for Heritage of Faith Church. You help believers study the exact teachings of Rev. Peter Ayoalabi from this sermon series.

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
- Do not generate generic Christian questions — they must be specific to this series content`;

    // 8. Build conversation history
    const conversationHistory = (chatHistory || [])
      .map((m) => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text || m.content || '' }],
      }))
      .filter((m) => m.parts[0].text.trim() !== '')
      .slice(-6);

    // 9. User message with segments
    const userMessageWithContext = `${seriesOverview}

TRANSCRIPT SEGMENTS — USE ONLY THESE:
${segmentList}

QUESTION: ${message}`;

    console.log(`[chat] ${relevantSegments.length} segments sent to Gemini`);

    // 10. Call Gemini with streaming
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
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