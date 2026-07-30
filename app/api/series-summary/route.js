import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
);

export async function POST(req) {
  const rl = rateLimit(req, { max: 8, windowMs: 60_000, prefix: 'series-summary' });
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { seriesId, title, sermonTitles, sermonIds } = await req.json();

    // Cached summary → zero tokens. Generation below runs once per series,
    // then the result is stored on the series row.
    if (seriesId) {
      const { data: cached } = await supabaseAdmin
        .from('series')
        .select('study_summary, suggested_questions')
        .eq('id', seriesId)
        .maybeSingle();
      if (cached?.study_summary) {
        return NextResponse.json({
          summary: cached.study_summary,
          suggestions: Array.isArray(cached.suggested_questions)
            ? cached.suggested_questions
            : [],
        });
      }
    }

    // Pull a small spread of sermon_segments per sermon (not the full
    // transcript — see CLAUDE.md rule 1) so the summary is grounded in what
    // was actually taught, not guessed from titles alone. A few excerpts
    // spaced across each message's timeline stand in for its shape without
    // costing anywhere near the tokens of the full text.
    let excerptText = '';
    if (Array.isArray(sermonIds) && sermonIds.length > 0) {
      const perSermonCount = sermonIds.length > 8 ? 2 : sermonIds.length > 4 ? 3 : 4;
      const { data: allSegments, error: segErr } = await supabaseAdmin
        .from('sermon_segments')
        .select('sermon_id, text, start_seconds')
        .in('sermon_id', sermonIds)
        .order('start_seconds', { ascending: true });

      if (!segErr && allSegments?.length) {
        const bySermon = new Map();
        for (const seg of allSegments) {
          if (!bySermon.has(seg.sermon_id)) bySermon.set(seg.sermon_id, []);
          bySermon.get(seg.sermon_id).push(seg);
        }

        const blocks = [];
        sermonIds.forEach((sid, i) => {
          const segs = bySermon.get(sid);
          if (!segs?.length) return;
          const picks = [];
          for (let p = 0; p < perSermonCount; p++) {
            const idx = Math.min(
              segs.length - 1,
              Math.floor(((p + 1) / (perSermonCount + 1)) * segs.length)
            );
            picks.push(segs[idx]);
          }
          blocks.push(
            `FROM "${sermonTitles[i]}":\n${picks.map((s) => `"${s.text}"`).join('\n')}`
          );
        });
        excerptText = blocks.join('\n\n');
      }
    }

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

    const hasExcerpts = excerptText.length > 0;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are writing for Heritage of Faith Church, from the warm perspective of someone INSIDE the congregation — never a detached outside observer. Generate a 5-7 sentence summary of a sermon series${
            hasExcerpts
              ? " grounded in the actual teaching excerpts provided below — name the specific, concrete themes and points he actually makes across the parts, the way someone who really listened would describe it. Don't write in vague generalities like 'helped us understand transformation' — say what the transformation actually is, what specific practices or ideas he taught, in his own terms where possible."
              : ' from its title and the titles of the sermons within it (no excerpts were available, so stay general rather than inventing specifics).'
          }

VOICE — this is the most important rule:
- Write in the first person plural: "us", "we", "our". The preacher teaches US and guides US through the series. NEVER write "the congregation", "believers", "the audience", or "listeners" as if the reader were outside looking in.
- Warm, faith-filled, and spiritually encouraging — yet concrete and specific, never vague or flowery.
- Only use what's actually in the excerpts below — never invent teaching content that isn't there.

${preacherContext} Only credit the preacher(s) named above — do not invent or assume any other preacher.`
        },
        {
          role: 'user',
          content: hasExcerpts
            ? `Series Title: ${title}\n\nTEACHING EXCERPTS ACROSS THE SERIES:\n${excerptText}`
            : `Series Title: ${title}\nSermon Titles:\n- ${sermonTitles.join('\n- ')}`
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
            content: `Based on this sermon teaching response, generate exactly 5 short tappable suggestion prompts a member of the congregation would want to explore next. Write in the first person plural — "we", "us", "our" — as one of us who just heard this teaching and wants to go deeper. Each one must be directly based on the content just taught — not generic.

STRICT LENGTH RULE: each suggestion is a short phrase or single simple question, 4-8 words, one idea only — never a compound sentence, never multiple clauses joined by "and"/"or". These are tap targets, not essay prompts. Think chip labels, not paragraphs.

Output only a JSON array of 5 strings, nothing else. Example format:\n["Living out our new identity","What born again really means","Facing doubt after the altar call","How surrender changes us","Walking in our new nature"]\n\nTeaching Response:\n${summary}`
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

    // Save back so this series never costs tokens again. Fails quietly if
    // the cache columns haven't been migrated yet.
    if (seriesId && summary && summary !== 'No summary available.') {
      const { error: saveErr } = await supabaseAdmin
        .from('series')
        .update({ study_summary: summary, suggested_questions: suggestions })
        .eq('id', seriesId);
      if (saveErr) console.warn('[series-summary] cache save skipped:', saveErr.message);
    }

    return NextResponse.json({ summary, suggestions });

  } catch (error) {
    console.error('Summary API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
