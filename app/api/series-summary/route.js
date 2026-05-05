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

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Summary API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
