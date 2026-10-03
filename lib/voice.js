// lib/voice.js
//
// Voice-fidelity hook for the Study Series chat. For church members who KNOW
// Rev. Peter, "does this sound like him?" matters more than a generically
// correct answer. This injects his verbatim signature phrasings into the system
// prompt so the model preserves his cadence instead of paraphrasing it away.
//
// These phrases were DERIVED, not invented: an n-gram frequency pass over 25 of
// Rev. Peter's own sermon transcripts (2026-07), keeping only phrasings that
// recur across many different sermons (13–23 each). Do NOT add phrases you
// haven't verified are genuinely his — putting words in his mouth is the exact
// failure this whole product exists to avoid. Note his wife, Pastor Funlola
// Alabi, preaches some series too; keep her phrasing OUT of this list.

// Rhetorical engagement — PRESERVE verbatim when a segment contains them, but do
// NOT inject them on your own (a chat answer peppered with rhetorical questions
// reads as parody).
export const ENGAGEMENT_PHRASES = [
  "Are you hearing what I'm saying?",
  "Are you seeing this?",
  "Did you see that?",
  "Do you see that?",
  "Are you getting this?",
];

// Affirmations — his habitual praise punctuation. Safe to ECHO sparingly where
// it fits naturally, in addition to preserving them when present.
export const AFFIRMATION_PHRASES = [
  "Glory to God",
  "Hallelujah",
  "Thank You, Lord",
  "Thank You, Jesus",
  "In the name of Jesus",
  "Lift your voice",
];

// ── Steward lingo ────────────────────────────────────────────────────────────
// FaithHub is for the church's stewards, and stewards don't say "Rev. Peter":
// he is "Dad". Pastor Funlola Alabi is "our Senior Pastor" in Ask and series-chat
// answers, and "Mom" in the notebook-style notes and series summaries (decided
// with the church, 2026-10-03). Guest ministers keep their own title and name.
// This is the one place the names live, so the app can go back to formal names
// if it ever opens to the wider church. UI labels, bylines and speaker chips are
// NOT generated prose and stay formal.
//
// The names follow the SPEAKER line and nothing else: "Dad" only for Rev.
// Peter's own messages. Multi-voice videos (tributes, panels) stay credited to
// the message, because church members say "Dad" there too.

const REV_PETER = 'Rev. Peter Alabi';
const FUNLOLA = 'Pastor Funlola Alabi';

/**
 * What generated prose calls a speaker. `speaker` is detectSpeaker()'s name
 * (null means Rev. Peter, the default); `feature` is 'answer' (Ask, series
 * chat) or 'notes' (study notes, series summaries).
 */
export function proseName(speaker, feature = 'answer') {
  if (!speaker || speaker === REV_PETER) return 'Dad';
  if (speaker === FUNLOLA) return feature === 'notes' ? 'Mom' : 'our Senior Pastor';
  return speaker;
}

// When a question names her ("What did Pastor Funlola teach…"), Gemini still
// opens with "Our Senior Pastor, Pastor Funlola Alabi, teaches…" despite the
// prompt. Answers stream through this; the longest match is ~42 characters,
// so a streaming caller must hold back at least that much.
const FUNLOLA_APPOSITIVE_RE = /\b([Oo]ur Senior Pastor),\s+(?:Pastor|Pst\.?)\s+Funlola(?:\s+Alabi)?(?:,(?=\s))?/g;
export const STEWARD_HOLD_BACK = 48;
export const stripFormalNames = (text) => text.replace(FUNLOLA_APPOSITIVE_RE, '$1');

export function stewardLingoSection(feature = 'answer') {
  const her = proseName(FUNLOLA, feature);
  return `

═══════════════════════════════════════
HOW WE NAME THE PREACHERS
═══════════════════════════════════════
The people reading this are stewards of Heritage of Faith Church. Name the preachers the way they do:
- ${REV_PETER} is "Dad". Write "Dad" wherever you would write "Rev. Peter", and "he" in between — don't open sentence after sentence with "Dad".
- ${FUNLOLA} is "${her}", and "she" in between.
- A guest minister keeps the title and name the SPEAKER line gives ("Pastor Gbeminiyi Eboda", "Rev. Victor Adeyemi").
- These names follow the SPEAKER line only. Never call anyone else "Dad" or "${her}". In a SPEAKER:UNKNOWN video, credit the message, never Dad — even when the segment itself says "Dad".
- Never write "Rev. Peter" or "${FUNLOLA}" in your own words. A message title that contains a name is fine.
- That holds on the first mention too, and when the question uses her name: "${her[0].toUpperCase() + her.slice(1)} teaches…", never "${her[0].toUpperCase() + her.slice(1)}, ${FUNLOLA}, teaches…".`;
}

export function voicePromptSection() {
  const engagement = ENGAGEMENT_PHRASES.map((p) => `  • "${p}"`).join('\n');
  const affirmations = AFFIRMATION_PHRASES.map((p) => `  • "${p}"`).join('\n');
  if (!engagement && !affirmations) return '';

  return `

═══════════════════════════════════════
REV. PETER'S VOICE — SIGNATURE PHRASING
═══════════════════════════════════════
Rev. Peter has a recognizable cadence. Sound like him, but never caricature him.
- PRESERVE: when a retrieved segment contains any of his phrasings below, keep it
  VERBATIM — do not smooth it into your own words.
- ECHO SPARINGLY: you may punctuate teaching with his affirmations where it fits
  naturally — at most once or twice, never forced, never invent new catchphrases.

His rhetorical engagement (preserve when present; do NOT inject on your own):
${engagement}

His affirmations (preserve, and may echo sparingly):
${affirmations}`;
}
