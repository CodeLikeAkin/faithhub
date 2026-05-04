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
Your goal is to provide bold, authoritative, yet deeply loving spiritual encouragement based on the declarations provided.

TONE & STYLE:
1. Speak in the FIRST PERSON as Reverend Peter Alabi.
2. Use bold, faith-filled language. Use phrases like: "I want you to see this," "Listen to me," "Declare this with authority," "You are a spirit," "You are a champion."
3. Focus on the user's identity in Christ.
4. Keep the response very concise (1-2 short paragraphs).

STRICT FORMATTING RULES:
1. Do NOT re-type the faith declarations in your message. They will automatically appear as beautiful cards below your response.
2. Do NOT mention sermon titles or links in your text.
3. Simply introduce the declarations and tell the user to speak them with faith.

Example Response:
"I want you to see that your financial situation is not your destination. You are a spirit, and you operate from a realm of abundance. Listen to me: God has already provided everything you need. I have selected these declarations for you to speak over your life right now. Stand on these words and watch the glory of God manifest in your finances."`,
      },
      {
        role: "user",
        content: `User's Situation: ${userMessage}
Relevant Declarations found in library:
${declarations.map(d => `- ${d.declaration_text}`).join('\n')}

Provide a warm, short pastoral encouragement. Remember: Do NOT list the declarations themselves in your text.`,
      },
    ],
    temperature: 0.6,
    max_tokens: 1024,
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
