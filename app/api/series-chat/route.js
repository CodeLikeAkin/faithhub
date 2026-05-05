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
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // 2. Build context from transcripts and build segments index
    const sortedSermons = series.series_sermons
      .sort((a, b) => a.part_number - b.part_number)
      .map(ss => ss.sermons);

    let segmentsIndex = [];
    let transcriptContext = `SERMON SERIES: ${series.title}\n\n`;
    
    sortedSermons.forEach((s, idx) => {
      transcriptContext += `[Sermon ${idx + 1}: ${s.title}]\nTranscript: ${s.transcript || "No transcript available."}\n\n`;
      
      // Build segments index (limit to 100 per sermon)
      const segments = (s.transcript_segments || []).slice(0, 100);
      segments.forEach(seg => {
        segmentsIndex.push({
          text: seg.text,
          start_seconds: Math.floor(seg.start_seconds),
          sermon_title: s.title,
          youtube_video_id: s.youtube_video_id
        });
      });
    });

    // 3. Construct the prompt with segment instructions
    const systemPrompt = `You are a study assistant for Heritage of Faith Church. 
You are helping someone study the sermon series: "${series.title}" by Rev. Peter Ayoalabi. 

STRICT RULES:
1. Answer ONLY from the transcript content and segments index provided. 
2. Do not add outside theology, personal opinions, or your own interpretation.
3. If the answer is not in the provided content, say "I'm sorry, I don't have information on that in this series."
4. When you make a claim, find the closest matching segment from the segments index provided. Use that segment's start_seconds and youtube_video_id to build the citation URL like this:
https://www.youtube.com/watch?v=[youtube_video_id]&t=[start_seconds]s

Format citations as [1], [2] inline at the end of the relevant sentence. 
At the end of your response, include a "CITATIONS" section listing each number used.

CITATION FORMAT IN THE CITATIONS SECTION:
[1] "segment text preview..." — Sermon Title — https://www.youtube.com/watch?v=xxx&t=342s

Example Response Structure:
Rev. Peter taught that faith is the substance of things hoped for [1]. He emphasized that we must stand on the word [2].

CITATIONS:
[1] "Now faith is the substance..." — Understanding Faith — https://www.youtube.com/watch?v=abc123&t=120s
[2] "You must stay in the word..." — The Word of God — https://www.youtube.com/watch?v=xyz789&t=450s`;

    // 4. Call Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `TRANSCRIPT CONTEXT:\n${transcriptContext}` },
        { role: 'system', content: `SEGMENTS INDEX (for citations):\n${JSON.stringify(segmentsIndex)}` },
        ...chatHistory.map(m => ({
          role: m.role,
          content: m.text
        })),
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2000,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I couldn't generate a response.";

    return NextResponse.json({ text: aiResponse });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
