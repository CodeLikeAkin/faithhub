import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

    sortedSermons.forEach((s, idx) => {
      // Limit each sermon transcript to first 3000 characters
      const transcriptSnippet = (s.transcript || "").substring(0, 3000);
      transcriptContext += `[Sermon ${idx + 1}: ${s.title}]\nTranscript: ${transcriptSnippet || "No transcript available."}\n\n`;

      // Build segments index (limit to 50 segments total across all sermons)
      if (segmentsIndex.length < 50) {
        const validSegments = (s.transcript_segments || []).filter(seg => {
          const videoId = seg.youtube_video_id || s.youtube_video_id;
          return videoId && seg.start_seconds !== undefined;
        });
        const remainingSpace = 50 - segmentsIndex.length;
        const segmentsToPush = validSegments.slice(0, remainingSpace);
        segmentsToPush.forEach(seg => {
          segmentsIndex.push({
            text: seg.text,
            start_seconds: Math.floor(seg.start_seconds),
            sermon_title: s.title,
            youtube_video_id: seg.youtube_video_id || s.youtube_video_id
          });
        });
      }
    });

    // 3. Construct the prompt with segment instructions
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

    const conversationHistory = (chatHistory || []).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.text
    }));

    const cleanMessages = conversationHistory.filter(
      m => (m.role === 'user' || m.role === 'assistant') &&
        m.content &&
        m.content.trim() !== ''
    );

    const recentMessages = cleanMessages.slice(-6);

    const userMessageWithContext = `
TRANSCRIPT SEGMENTS INDEX (use these for citations):
${JSON.stringify(segmentsIndex, null, 2)}

FULL SERMON TRANSCRIPTS:
${transcriptContext}

USER QUESTION:
${message}
`;

    console.log('Segments being sent to AI:', JSON.stringify(segmentsIndex.slice(0, 3), null, 2));
    console.log('Total segments count:', segmentsIndex.length);
    console.log('Total transcript length being sent:', transcriptContext.length);
    console.log('Sermons loaded for this series:',
      sortedSermons.map(s => ({
        title: s.title,
        transcriptLength: s.transcript?.length,
        segmentCount: s.transcript_segments?.length
      }))
    );

    // 4. Call Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
        { role: 'user', content: userMessageWithContext }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2000,
      stream: true,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
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
    // Add try/catch and log the actual error with console.error
    console.error('Chat API Error:', error);
    // If Groq or any part returns an error, return it as JSON
    return NextResponse.json({
      error: true,
      message: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
