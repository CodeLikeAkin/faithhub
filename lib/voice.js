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
