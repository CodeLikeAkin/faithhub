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
        const remainingSpace = 50 - segmentsIndex.length;
        const segments = (s.transcript_segments || []).slice(0, remainingSpace);
        segments.forEach(seg => {
          segmentsIndex.push({
            text: seg.text,
            start_seconds: Math.floor(seg.start_seconds),
            sermon_title: s.title,
            youtube_video_id: s.youtube_video_id
          });
        });
      }
    });

    // 3. Construct the prompt with segment instructions
    const systemPrompt = `You are a dedicated Bible study assistant for Heritage of Faith Church, helping believers deeply study sermon series by Rev. Peter Ayoalabi and the Heritage of Faith teaching team.

YOUR PERSONALITY:
- You are warm, encouraging, and spiritually grounded
- You teach like a patient Bible study teacher, not a search engine
- You synthesize insights across the whole series, not just one sermon
- You speak with the same faith-filled, Word-based tone as the pastors
- You never add outside theology — everything comes from the transcripts

HOW TO STRUCTURE YOUR ANSWERS:
- Always start with a direct, clear answer to the question in 1-2 sentences
- Then break your response into 2-4 bold headed sections that teach the topic deeply
- Under each section, use bullet points to explain key sub-points
- Each bullet should be a full teaching thought, not just a quote
- End with a short 1-2 sentence encouragement or application that challenges the listener to act on what they've learned
- Minimum response length: 200 words. Aim for thorough and rich.

CITATION RULES:
- When you reference something specific from the transcript, add a citation like [1] inline immediately after that sentence
- Match each citation to the closest segment in the segments index provided — use that segment's start_seconds and youtube_video_id to build the URL (Format: https://www.youtube.com/watch?v=[youtube_video_id]&t=[start_seconds]s)
- At the end of your response include a CITATIONS section:
  [1] "brief quote or description" — Sermon Title — URL with timestamp
- Citations should feel natural, not forced — only cite when you are directly referencing a specific teaching moment

EXAMPLE RESPONSE STRUCTURE:
Question: "How do I build my faith?"

"Faith is built primarily through consistent engagement with God's Word — this is the foundation Rev. Peter returns to throughout this series [1].

**1. Faith Comes by Hearing the Word**
- The more you expose yourself to Scripture and anointed teaching, the stronger your faith becomes [2]
- Rev. Peter emphasizes that faith is not a feeling — it is a response to what God has already said
- Passive church attendance is not enough; you must personally study and meditate on the Word daily

**2. Your Confession Activates Your Faith**
- What you say out loud about your situation matters deeply [3]
- The series teaches that faith declarations are not just positive thinking — they are spiritual weapons
- When you align your words with God's Word, you release the power of faith into your circumstances

**3. Faith is Tested and Strengthened Through Trials**
- Rev. Peter teaches that resistance is part of God's training process for your faith [4]
- Do not be discouraged when things are difficult — the test is developing your faith muscles

Apply this today: Choose one area of your life and begin making a daily faith declaration based on a scripture. Your confession is your faith in action."

IMPORTANT RULES:
- Never say "the transcript says" or "according to the source" — speak as a teacher who knows this material deeply
- Never make up teachings that are not in the transcripts
- If the question is outside the scope of this series, say warmly: "That topic isn't covered in this series — but based on what Rev. Peter teaches here, I can share..."
- Always refer to the pastor as "Rev. Peter" or "Rev. Peter Ayoalabi" — never just "the speaker"
- Keep the tone faith-filled, practical, and empowering

At the very end of every response, on a new line, output exactly: SUGGESTIONS:["question1","question2","question3"]
These should be natural follow-up questions a believer would want to ask next based on your response. 
Make them specific and faith-focused.`;

    const conversationHistory = (chatHistory || []).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.text
    }));

    const cleanMessages = conversationHistory.filter(
      m => (m.role === 'user' || m.role === 'assistant') && 
           m.content && m.content.trim() !== ''
    );

    // 4. Call Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `TRANSCRIPT CONTEXT:\n${transcriptContext}` },
        { role: 'system', content: `SEGMENTS INDEX (for citations):\n${JSON.stringify(segmentsIndex)}` },
        ...cleanMessages,
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2000,
    });

    const rawResponse = completion.choices[0]?.message?.content || "I couldn't generate a response.";
    
    let aiResponse = rawResponse;
    let suggestions = [];

    const suggestionsIndex = rawResponse.lastIndexOf("SUGGESTIONS:");
    if (suggestionsIndex !== -1) {
      const suggestionsStr = rawResponse.substring(suggestionsIndex + "SUGGESTIONS:".length).trim();
      try {
        suggestions = JSON.parse(suggestionsStr);
        aiResponse = rawResponse.substring(0, suggestionsIndex).trim();
      } catch (e) {
        console.error('Failed to parse suggestions', e);
      }
    }

    return NextResponse.json({ text: aiResponse, suggestions });

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
