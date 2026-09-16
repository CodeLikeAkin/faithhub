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
