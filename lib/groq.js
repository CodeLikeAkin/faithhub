import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * True if a Gemini SDK error is a capacity issue on Gemini's side — quota/
 * rate-limit (HTTP 429 / RESOURCE_EXHAUSTED) or the model being overloaded
 * (HTTP 503 / UNAVAILABLE) — rather than some other failure (bad request,
 * network). Used to decide whether it's safe to fall back to Groq — a 400
 * means our prompt is broken and Groq would fail the same way, but a 429 or
 * 503 is purely a Gemini-side capacity issue that has nothing to do with our
 * own usage.
 */
export function isGeminiQuotaError(err) {
  const status = err?.status ?? err?.response?.status;
  return (
    status === 429 ||
    status === 503 ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|"code":\s*(429|503)/i.test(String(err?.message || ""))
  );
}

// The frontend (StudyChat.js) splits the answer into a "Quick answer" box
// vs. the main body by looking for the first blank-line paragraph break —
// Gemini reliably writes "one-sentence lead\n\nrest of the answer", but Groq's
// Llama models often don't insert that break, which collapses the whole
// answer into the quick-answer box. Find the end of the first sentence and
// inject the break ourselves so the split works no matter which provider
// answered.
//
// MIN_LEAD_LENGTH guards against "Rev." — the system prompt has the model
// refer to "Rev. Peter" constantly, and a naive period+space+capital match
// fires on that abbreviation and splits the lead down to just "Rev.". Scan
// past any match that lands before a real sentence could plausibly have
// ended.
const MIN_LEAD_LENGTH = 30;

function splitLeadSentence(buffer) {
  const re = /[.!?]["')\]]?\s+(?=[A-Z"'(])/g;
  let match;
  while ((match = re.exec(buffer))) {
    const idx = match.index + match[0].length;
    if (idx >= MIN_LEAD_LENGTH) {
      return { lead: buffer.slice(0, idx).trimEnd(), rest: buffer.slice(idx) };
    }
  }
  return null;
}

// Buffers only as much of the stream as needed to find that first sentence
// boundary (or ~320 chars, if the model never gives us a clean one) — after
// that, chunks pass straight through untouched so the rest of the answer
// still streams normally.
async function* ensureLeadParagraphBreak(chunks) {
  const MAX_LEAD_BUFFER = 320;
  let buffer = "";
  let injected = false;

  for await (const chunk of chunks) {
    if (injected) {
      yield chunk;
      continue;
    }

    buffer += chunk;

    if (buffer.includes("\n\n")) {
      injected = true;
      yield buffer;
      buffer = "";
      continue;
    }

    const split = splitLeadSentence(buffer);
    if (split) {
      injected = true;
      yield `${split.lead}\n\n${split.rest}`;
      buffer = "";
      continue;
    }

    if (buffer.length > MAX_LEAD_BUFFER) {
      // No clean sentence boundary yet — stop waiting so the stream doesn't
      // stall; this one answer just won't get the quick-answer split.
      injected = true;
      yield buffer;
      buffer = "";
    }
  }

  if (!injected && buffer) yield buffer;
}

/**
 * Streams a chat completion from Groq using the same (systemPrompt, history,
 * userMessage) shape the Gemini routes already build, so it can be swapped in
 * as a drop-in fallback when Gemini's free-tier quota is exhausted.
 * `history` entries use {role: 'user'|'assistant', content}.
 */
export async function* streamGroqAnswer({ systemPrompt, userMessage, history = [] }) {
  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 4096,
    stream: true,
  });

  async function* rawChunks() {
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }

  yield* ensureLeadParagraphBreak(rawChunks());
}

/**
 * Sends the user's message and a curated list of declarations to Groq.
 * The model is instructed to ONLY surface content from the provided declarations.
 *
 * @param {string} userMessage - The user's situation / need in plain text.
 * @param {Array<{declaration_text: string, sermon_title: string, youtube_url_with_timestamp: string}>} declarations
 * @returns {Promise<string>} - The AI response text.
 */
export async function getDeclarations(userMessage, declarations) {
  const declarationsContext = declarations
    .map(
      (d, i) =>
        `[${i + 1}] Declaration: "${d.declaration_text}"\n    Sermon: "${d.sermon_title}"\n    Link: ${d.youtube_url_with_timestamp}`
    )
    .join("\n\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are Reverend Peter Ayo Alabi, the Lead Pastor of Heritage of Faith Church.
You are speaking directly to someone who just shared a personal need. Respond with warmth, boldness, and faith.

ABSOLUTE RULES:
1. Write EXACTLY 2 sentences. No more. No exceptions.
2. Sentence 1 — Speak directly to what the person shared. Acknowledge their specific situation with empathy and faith. Make it personal, not generic.
3. Sentence 2 — Point them toward what God has for them. Be bold and specific to their need.
4. Do NOT list, repeat, or reference the declarations — they appear automatically as cards below your message.
5. Do NOT mention sermon titles, links, or sources.
6. Do NOT say "declare these words", "speak these over your life", "stand on these", or any instruction about the cards. The user already knows what to do.

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

Respond in exactly 2 sentences. Be personal to what they said. Do NOT reference or list any declarations.`,
      },
    ],
    temperature: 0.85,
    max_tokens: 256,
  });

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
    model: "llama-3.3-70b-versatile",
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
