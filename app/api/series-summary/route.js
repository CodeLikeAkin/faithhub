import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const { title, sermonTitles } = await req.json();

    // Sermon titles carry the preacher's name inline, e.g.
    // "... | Pastor Funlola Alabi | 21st June 2026" — extract it instead of
    // assuming every series was preached by Rev. Peter Ayo Alabi.
    const preacherNames = new Set();
    const preacherPattern = /(Rev(?:erend|\.)?|Pastor|Bishop|Dr\.?)\s+[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,3}/g;
    for (const t of sermonTitles) {
      const matches = t.match(preacherPattern) || [];
      for (const m of matches) preacherNames.add(m.trim());
    }
    const preacherContext = preacherNames.size > 0
      ? `This series was preached by ${[...preacherNames].join(' and ')}. Focus on the core themes of their teachings.`
      : 'Focus on the core themes of the teachings.';

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are writing for Heritage of Faith Church, from the warm perspective of someone INSIDE the congregation — never a detached outside observer. Generate a 3-5 sentence summary of a sermon series from its title and the titles of the sermons within it.

VOICE — this is the most important rule:
- Write in the first person plural: "us", "we", "our". The preacher teaches US and guides US through the series. NEVER write "the congregation", "believers", "the audience", or "listeners" as if the reader were outside looking in.
- Warm, faith-filled, and spiritually encouraging — yet concise and grounded, never flowery or overstated.

${preacherContext} Only credit the preacher(s) named above — do not invent or assume any other preacher.`
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
            content: `Based on this sermon teaching response, generate exactly 3 specific follow-up questions a member of the congregation would naturally want to ask next. Ask in the first person plural — use "we", "us", "our" — as one of us who just heard this teaching and wants to go deeper. The questions must be directly based on the content just taught — not generic. Output only a JSON array of 3 strings, nothing else. Example format:\n["Question one?","Question two?","Question three?"]\n\nTeaching Response:\n${summary}`
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
