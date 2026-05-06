import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { seriesId, message, chatHistory } = await req.json();

    // 1. Fetch series and sermons with transcripts and segments
    const { data: series, error } = await supabase
      .from('series')
      .select(`
        title,
        series_sermons (
          part_number,
          sermons (
            title, 
            youtube_video_id, 
            transcript,
            transcript_segments
          )
        )
      `)
      .eq('id', seriesId)
      .single();

    if (error || !series) {
      return NextResponse.json({ error: true, message: 'Series not found' }, { status: 404 });
    }

    // 2. Build context from transcripts and build segments index
    const sortedSermons = series.series_sermons
      .sort((a, b) => a.part_number - b.part_number)
      .map(ss => ss.sermons);

    let segmentsIndex = [];
    let transcriptContext = `SERMON SERIES: ${series.title}\n\n`;
    const MAX_SEGMENTS = 100;
    const segmentsPerSermon = Math.floor(MAX_SEGMENTS / (sortedSermons.length || 1));

    sortedSermons.forEach((s, idx) => {
      // 1. Full transcript
      transcriptContext += `[Sermon ${idx + 1}: ${s.title}]\nTranscript: ${s.transcript || "No transcript available."}\n\n`;

      // 2. Build segments index (spread evenly across the sermon)
      const validSegments = (s.transcript_segments || []).filter(seg => {
        const videoId = seg.youtube_video_id || s.youtube_video_id;
        return videoId && seg.start_seconds !== undefined;
      });

      if (validSegments.length > 0) {
        const numToTake = Math.min(validSegments.length, segmentsPerSermon);
        for (let i = 0; i < numToTake; i++) {
          const selectIdx = Math.floor(i * (validSegments.length / numToTake));
          const seg = validSegments[selectIdx];
          segmentsIndex.push({
            text: seg.text,
            start_seconds: Math.floor(seg.start_seconds),
            sermon_title: s.title,
            youtube_video_id: seg.youtube_video_id || s.youtube_video_id
          });
        }
      }
    });

    // 3. System prompt (unchanged)
    const systemPrompt = `You are a Bible study assistant exclusively for Heritage of Faith Church sermon series. You help believers study the EXACT teachings of Rev. Peter Ayoalabi and the Heritage of Faith teaching team.

STRICT SOURCING RULE — THIS IS YOUR MOST IMPORTANT INSTRUCTION:
- You may ONLY teach what is explicitly stated in the transcript segments provided to you below
- If a point cannot be directly traced to something said in the transcript, DO NOT include it — remove it entirely
- Never add outside theology, generic Christian advice, or anything you know from your training data
- If the question asks about something not covered in the transcripts, say warmly: "Rev. Peter does not cover that specific topic in this series. Here is what he does teach that is closest to your question: [then cite what is actually there]"
- You are a reporter of what Rev. Peter said, not a theologian adding your own commentary

CITATION RULE — MANDATORY:
- Every single bullet point MUST end with a citation [N]
- Every section heading claim MUST have a citation [N]
- If you cannot find a segment that supports a point, DELETE that point entirely — do not include uncited claims
- Only cite segments that have a valid youtube_video_id and start_seconds. If a segment has no timestamp data, do not cite it — find a different segment that does.
- Citations must reference real segments from the segments index provided — match the text as closely as possible
- At the end of your response include a CITATIONS section:
  [1] "exact short quote from segment" — Sermon Title — YouTube URL with &t=start_seconds

HOW TO STRUCTURE YOUR ANSWERS:
- Start with 1-2 sentences directly answering the question, citing the most relevant segment immediately [1]
- Then 2-4 bold section headings that reflect what Rev. Peter ACTUALLY taught — use his exact language and phrases where possible
- Under each heading, 2-3 bullet points — each MUST end with [N]
- End with a short application challenge that uses Rev. Peter's own words or phrases from the transcript, cited [N]
- Minimum 200 words, but never pad with uncited content

TONE:
- Warm, faith-filled, and grounded in the Word
- Speak as a study companion who has deeply read these transcripts
- Use Rev. Peter's own language and phrases — mirror his voice
- Never say "the transcript says" — teach it as living truth
- Always refer to the pastor as "Rev. Peter" or "Rev. Peter Ayoalabi" — never "the speaker" or "the pastor"

FOLLOW-UP SUGGESTIONS:
- At the very end of every response, on a new line, output exactly:
  SUGGESTIONS:["Question one based on what Rev Peter actually taught?", "Question two based on what Rev Peter actually taught?", "Question three based on what Rev Peter actually taught?"]
- These must be questions that can be answered FROM THE TRANSCRIPT — do not suggest questions about topics not covered in the series`;

    // 4. Build conversation history — swap 'ai'/'assistant' → 'model', 'user' stays 'user'
    const conversationHistory = (chatHistory || [])
      .map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text || m.content || '' }]
      }))
      .filter(m => m.parts[0].text.trim() !== '');

    const recentHistory = conversationHistory.slice(-6);

    const segmentList = segmentsIndex.map((seg, i) => 
      `--- CITATION ID: [${i + 1}] ---
      Quote: "${seg.text}"
      Sermon: ${seg.sermon_title}
      Location: TimeRef-${seg.start_seconds}s
      Video: ${seg.youtube_video_id}`
    ).join('\n\n');

    const userMessageWithContext = `
TRANSCRIPT SEGMENTS INDEX (ONLY USE THE [CITATION ID] FOR YOUR BRACKETED CITATIONS):
${segmentList}

FULL SERMON TRANSCRIPTS:
${transcriptContext}

USER QUESTION:
${message}
`;

    console.log('Total segments count:', segmentsIndex.length);
    console.log('Total transcript length being sent:', transcriptContext.length);

    // 5. Call Gemini with streaming
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt + `
      
      CITATION SYSTEM RULES:
      1. You are provided with a "TRANSCRIPT SEGMENTS INDEX" containing numbered items like --- CITATION ID: [1] ---.
      2. When you make a point, you MUST end the bullet or sentence with the ID in brackets, e.g., [1] or [1][3].
      3. NEVER use "TimeRef" or seconds (e.g., [1455]) as a citation ID.
      4. The CITATIONS section at the end is MANDATORY and must map the IDs back to full references.
      Format: [N] "short quote" — Sermon Title — https://youtube.com/watch?v=VideoID&t=StartTime`,
    });

    const chat = model.startChat({ history: recentHistory });
    const result = await chat.sendMessageStream(userMessageWithContext);

    // 6. Stream the response back exactly as before
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const content = chunk.text();
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({
      error: true,
      message: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}