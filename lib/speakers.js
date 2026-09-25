// There is no `speaker` column on `sermons` (see memory: corpus-is-multi-
// speaker) — speaker is derived from the raw YouTube title at render time,
// the same pattern lib/titles.js already uses for cleanTitle()/partLabel().

const FUNLOLA_RE = /funlola/i;
const REV_PETER_RE = /rev\.?\s*peter|pastor peter|apostle peter/i;

// Any other "<Ministerial title> <Name>" in the title is treated as a guest.
// Case-insensitive and title-case-agnostic so it also matches ALL-CAPS
// uploads (e.g. "REV GBEMINIYI EBODA").
const GUEST_RE =
  /\b(pastor|rev\.?|reverend|apostle|prophet(?:ess)?|evangelist|bishop|dr\.?)\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,2})/i;

/**
 * Best-effort speaker attribution from a raw sermon title.
 * Returns { name, isGuest }. `name` is null when no minister name is
 * recognizable in the title at all — that's the conservative default
 * (~373 sermons), presumed Rev. Peter's regular ministry, never surfaced
 * as a guest.
 */
export function detectSpeaker(raw) {
  if (!raw) return { name: null, isGuest: false };
  if (FUNLOLA_RE.test(raw)) return { name: "Pastor Funlola Alabi", isGuest: false };
  if (REV_PETER_RE.test(raw)) return { name: "Rev. Peter Alabi", isGuest: false };
  const m = raw.match(GUEST_RE);
  if (m) {
    // Stop at a possessive ("...Oyemade's Ministration" -> "Oyemade") so a
    // trailing noun doesn't get swept into the captured name.
    const name = m[2].trim().replace(/'s\b.*$/i, "").trim();
    return { name: titleCase(name), isGuest: true };
  }
  return { name: null, isGuest: false };
}

function titleCase(name) {
  return name
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// Titles whose videos are not one person preaching: birthday tributes, panel
// sessions, anniversary celebrations. Members, guests and family take the
// microphone one after another, so a segment from one of these is as likely
// to be a church member as the minister named in the title — the "Happy
// Birthday DAD" tributes and the "Army of Disciples Book Review Panel" both
// got quoted as Rev. Peter's own teaching before this existed.
const MULTI_VOICE_RE =
  /\b(?:birthday|tribute|panel|iconic|celebrat\w*|testimon\w*|interview|ordination|dedication|anniversar\w*|valedictor\w*|award)\b/i;

/**
 * True when a sermon's title marks it as a multi-speaker event, so no single
 * speaker can be assumed for any segment inside it.
 */
export function isMultiVoice(raw) {
  return MULTI_VOICE_RE.test(raw || "");
}
