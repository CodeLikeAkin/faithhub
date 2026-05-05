import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const { title, sermonTitles } = await req.json();

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for a church. Generate a 3-5 sentence AI-generated summary of a sermon series based on its title and the titles of the sermons within it. Keep it concise, professional, and spiritually encouraging. Focus on the core themes of Rev. Peter Ayoalabi\'s teachings.'
        },
        {
          role: 'user',
          content: `Series Title: ${title}\nSermon Titles:\n- ${sermonTitles.join('\n- ')}`
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
    });

    const summary = completion.choices[0]?.message?.content || "No summary available.";

    // Generate 3 contextual suggestions based on the summary
    let suggestions = [];
    try {
      const suggestionsCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Output only a JSON array of 3 strings, nothing else.'
          },
          {
            role: 'user',
            content: `Based on this sermon teaching response, generate exactly 3 specific follow-up questions a believer would naturally want to ask next. The questions must be directly based on the content just taught — not generic. They should feel like a curious student who just heard this teaching and wants to go deeper. Output only a JSON array of 3 strings, nothing else. Example format:\n["Question one?","Question two?","Question three?"]\n\nTeaching Response:\n${summary}`
          }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.5,
      });

      const content = suggestionsCompletion.choices[0]?.message?.content || "[]";
      const startIdx = content.indexOf('[');
      const endIdx = content.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = content.substring(startIdx, endIdx + 1);
        suggestions = JSON.parse(jsonStr);
      }
    } catch (e) {
      console.error('Failed to generate summary suggestions', e);
    }

    return NextResponse.json({ summary, suggestions });

  } catch (error) {
    console.error('Summary API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
