import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Plans a "What are you facing?" search: three short declaration-shaped
 * lines (for the semantic search legs) plus the need's own nouns (for a
 * keyword leg) — instead of one rewrite.
 *
 * gte-small matches wording, not meaning. A single rewrite is single-minded:
 * it leans either toward the concrete need ("my ears are healed") or toward
 * role/outcome language ("I walk in wisdom"), and only ever recovers
 * whichever slice of the library that one phrasing happens to sit near.
 * Three differently-worded lines — plain need, the church's/Bible's own
 * words for it, the specific outcome believed for — each land in a
 * different neighbourhood of the vector space; the caller fuses all three
 * search legs (plus the keyword legs) so the recall isn't luck-of-phrasing.
 * See app/api/declarations/route.js for how the lines and keywords are used.
 *
 * @param {string} userMessage - The user's situation / need in plain text.
 * @returns {Promise<{declarations: string[], keywords: string[]}|null>} - null if Groq failed or returned unusable JSON (caller falls back to a single search on the raw message).
 */
export async function planDeclarationSearch(userMessage) {
  try {
    const completion = await groq.chat.completions.create(
      {
        model: "openai/gpt-oss-20b",
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You help search a library of about 6,000 short faith declarations from Rev. Peter Ayo Alabi's sermons (Heritage of Faith Church, Lagos). They are first-person confessions in charismatic church language that often echo the King James Bible. Examples:
- "God remembers me, and every closed womb in my life is now open."
- "I receive a smooth and safe takeoff, a smooth and safe flight, and a smooth and safe landing."
- "All my bills and debts are being reduced and eliminated."
- "Depression is not my portion; I encourage myself in the Lord my God."
- "My children will not be derailed."

Someone has typed what they are facing. Reply with JSON: {"declarations": [three strings], "keywords": [strings]}.

declarations: three different short declarations (under 15 words each), each about ONE idea, that they would speak over this exact situation.
1. In plain everyday words, naming the concrete need ("My ears are healed and my hearing is fully restored").
2. In the church's and the Bible's own words for that need (closed womb, lust of the flesh, enemies, verdict, heaviness, journeys, favour).
3. The specific outcome they are believing for.

Rules for the declarations:
- Always write as "I" and "my", never "we" or "our". The search matches sentence form, and the library is written as "I" and "my".
- If it is about someone else, name them with "my" ("My daughter…", "My mother…", "My husband…").
- If they name a person but no problem, write what believers usually declare over that person (for children: protection, wisdom, favour, not derailed).
- Every sentence must be about the need itself. Leave out words that fit any declaration and blur the search: walk, purpose, thrive, guided, grace, blessed, power, destiny, victorious, "I declare", "the Lord declares", "in the name of Jesus".
- Family words mean family. "My father died" is about their earthly father and grief, and "my son" is their child, not God the Father or the Son of God.
- If they give only a Bible reference, say what that verse says.

keywords: 0 to 3 nouns that name the need itself and would literally appear in a matching declaration, e.g. ["womb","barren"], ["debts","bills"], ["journey"], ["enemies"], ["lust"], ["children"]. Only the need's own nouns, never outcome or feeling words (future, success, victory, prosperous, love, peace, result, tomorrow) and never God, Lord, life, faith, father. If no such noun fits, return [].`,
          },
          { role: "user", content: userMessage },
        ],
        // Deterministic, so "Show 10 more" re-runs recover a consistent pool.
        temperature: 0,
        max_tokens: 700,
      },
      // A search helper, not the answer: fail fast and fall back to the raw message.
      { timeout: 6000, maxRetries: 0 }
    );
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    if (!Array.isArray(parsed.declarations) || parsed.declarations.length === 0) return null;
    return {
      declarations: parsed.declarations.filter((d) => typeof d === "string" && d.trim()),
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k) => typeof k === "string" && k.trim())
        : [],
    };
  } catch (err) {
    console.error("[groq] Declaration search plan failed:", err.message);
    return null;
  }
}

/**
 * Picks and orders the declarations from planDeclarationSearch's fused
 * candidate pool that actually fit what the user shared.
 *
 * The fused search order is positional (1/(rrf_k+rank) — see
 * match_declarations_hybrid in supabase/migrations/hybrid_search.sql), not a
 * relevance judgement, so a candidate that only shares a word with the need
 * (e.g. "Father" for someone whose father died) can still rank near the top
 * of a leg. This reads the actual sentences and re-picks.
 *
 * @param {string} userMessage - The user's situation / need in plain text.
 * @param {string[]} candidateTexts - declaration_text of each candidate, in fused order.
 * @returns {Promise<number[]|null>} - 1-based indices into candidateTexts, best fit first; null if Groq failed or picked nothing (caller keeps the fused order).
 */
export async function rerankDeclarations(userMessage, candidateTexts) {
  try {
    const completion = await groq.chat.completions.create(
      {
        model: "openai/gpt-oss-20b",
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You choose faith declarations for someone who shared what they are facing. The candidates are real declarations from Rev. Peter Ayo Alabi's sermons.

Pick the candidates that speak to their actual need, best fit first, up to 15.
- Best: lines about the same need (hearing or ears for a hearing problem, a job for job loss, children for a child, the womb or a baby for someone trying to conceive, enemies for people plotting). A line said as "I/my" still fits when the need is about a family member.
- Next: general encouragement that clearly applies (general healing for an illness, general provision for a money need).
- When they say who they are and what they are facing ("I'm a pastor and I'm tired", "I'm a student and I'm scared"), the need is what they are facing, not their role. Don't pick lines that only match the role.
- Skip lines that only share a word with their need (God the Father for someone whose father died, "son of God" for a parent's son), and lines about a different need.
- If only a few fit, pick only those.

Reply with JSON: {"picks": [candidate numbers]}`,
          },
          {
            role: "user",
            content: `They shared: "${userMessage}"\n\nCandidates:\n${candidateTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
          },
        ],
        temperature: 0,
        max_tokens: 1500,
      },
      // Search-quality helper, not the answer: fail fast and fall back to the fused order.
      { timeout: 7000, maxRetries: 0 }
    );
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    if (!Array.isArray(parsed.picks)) return null;
    const picks = [...new Set(parsed.picks.map(Number))].filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= candidateTexts.length
    );
    return picks.length > 0 ? picks : null;
  } catch (err) {
    console.error("[groq] Declaration rerank failed:", err.message);
    return null;
  }
}

/**
 * Writes the short pastoral note shown above the declaration cards. It speaks
 * to the user's message only. The cards are deliberately left out of the
 * prompt so the note can never list, quote or point at them.
 *
 * @param {string} userMessage - The user's situation / need in plain text.
 * @param {{ signal?: AbortSignal }} [options] - lets the route cancel a note it won't use.
 * @returns {Promise<string>} - The AI response text.
 */
export async function getDeclarations(userMessage, { signal } = {}) {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: `You are Reverend Peter Ayo Alabi, the Lead Pastor of Heritage of Faith Church.
You are speaking directly to someone who just shared a personal need. Respond with warmth, boldness, and faith.

ABSOLUTE RULES:
1. Write EXACTLY 2 sentences. No more. No exceptions.
2. Each sentence should be a full, warm thought — roughly 15-25 words. Avoid one long winding clause with three sub-clauses, but don't clip it into a bare, robotic fragment either. It should still sound like a pastor talking, not a caption.
3. Sentence 1 — Speak directly to what the person shared. Acknowledge their specific situation with empathy and faith. Make it personal, not generic.
4. Sentence 2 — Point them toward what God has for them. Be bold and specific to their need.
5. Do NOT list, repeat, or reference the declarations — they appear automatically as cards below your message.
6. Do NOT mention sermon titles, links, or sources.
7. Do NOT say "declare these words", "speak these over your life", "stand on these", or any instruction about the cards. The user already knows what to do.

VARIETY — You MUST rotate your opening style. NEVER start two responses the same way. Pick ONE of these approaches at random each time:
- Start with a bold identity statement ("You are…", "Your spirit…")
- Start with an empathetic acknowledgment ("I know what it feels like when…", "That season you're walking through…")
- Start with a declaration of God's nature ("The God who called you…", "Heaven is not silent about…")
- Start with a direct word of encouragement ("Don't let the enemy…", "This is your moment to…")
- Start with a scripture-inspired truth without quoting chapter/verse ("You were not made for defeat…", "The same power that raised Christ…")

BANNED PHRASES — Never use any of these:
"I want you to see", "Listen to me", "You are a champion", "Declare this with authority", "I have selected these", "Speak these with faith", "Stand on these words"

VOICE: You are warm, fatherly, bold, and faith-filled. You speak like a pastor who genuinely loves his congregation — not like a motivational poster.`,
      },
      {
        role: "user",
        content: `Someone just shared this with you: "${userMessage}"

Respond in exactly 2 warm, full sentences (roughly 15-25 words each — concise, not clipped). Be personal to what they said. Do NOT reference or list any declarations.`,
      },
    ],
    temperature: 0.85,
    max_tokens: 256,
  }, { signal });

  return completion.choices[0]?.message?.content || "No response generated.";
}

/**
 * Classifies the user's message into one of the predefined topics.
 *
 * @param {string} userMessage
 * @returns {Promise<{topic: string | null, keywords: string[]}>}
 */
export async function classifyUserIntent(userMessage) {
  const topics = [
    'mindset',
    'faith',
    'strength',
    'blessing',
    'relationships',
    'healing',
    'purpose',
    'identity',
    'finances',
    'fear'
  ];

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: `You are an expert classifier for a Christian faith application.
Your task is to analyze the user's message and map it to the MOST relevant topic from the following list:
${topics.join(', ')}

RULES:
1. If the message is about jobs, money, career, debt, or provision, map to 'finances'.
2. If the message is about marriage, family, children, or friends, map to 'relationships'.
3. If the message is about health, sickness, or physical recovery, map to 'healing'.
4. If the message is about calling, direction, or the future, map to 'purpose'.
5. If the message is about fear, anxiety, or worry, map to 'fear'.
6. Return a JSON object with 'topic' (the slug) and 'keywords' (3-4 specific nouns/verbs from the message for text search).
7. If NO topic fits well, return null for topic but still provide keywords.

Example Output:
{ "topic": "finances", "keywords": ["job", "employment", "income"] }`,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  try {
    return JSON.parse(completion.choices[0]?.message?.content);
  } catch (e) {
    return { topic: null, keywords: [] };
  }
}
