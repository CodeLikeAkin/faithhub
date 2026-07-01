import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
