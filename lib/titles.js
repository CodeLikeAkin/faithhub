// Sermon titles arrive as raw YouTube strings like
//   "Then And Now Part 1 - New Creation Realities | Rev Peter Alabi | 7th June 2026"
// and occasionally carry data glitches (the whole prefix duplicated). These
// helpers derive clean display titles so raw strings never reach the UI.

// The channel tag some uploads lead with ("HOFCHURCHNG | DAY ONE MORNING | …",
// "HOFCHURCHGLOBAL | FIRST SERVICE | …") — never the message's title, so
// it's skipped.
const CHANNEL_TAG = /^hof\s*church\s*(ng|global)$/i;

// A few dozen titles were saved with their HTML escapes intact
// ("GOD&#39;S PLAN", "GRACE &amp; RADIANCE") — decode them for display.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#34": '"' };
const decodeEntities = (s) =>
  (s || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    const key = code.toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (key[0] === "#") {
      const n = key[1] === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "with"]);

// Words that stay in capitals even when the rest of an ALL-CAPS title is
// softened: acronyms, roman numerals, and the divine names.
const KEEP_CAPS = new Set(["HCM", "RFC", "HOF", "HOFNG", "WOFBEC", "II", "III", "IV", "LORD", "GOD", "KJV", "NLT"]);

// One house style for every title: title case ("Then And Now" → "Then and
// Now"), small words lowercase, ALL-CAPS titles softened ("GO YE" → "Go Ye"),
// and God always GOD.
function smartTitle(s) {
  if (!s) return "";
  const allCaps = /[A-Z]/.test(s) && !/[a-z]/.test(s);
  let prevBreak = true;
  const words = s.split(" ").map((tok, i) => {
    const first = i === 0 || prevBreak || /^[("'“‘]/.test(tok);
    prevBreak = /[:–—]$/.test(tok) || /^[-–—]$/.test(tok);
    return tok
      .split("-")
      .map((part, pi) => {
        const m = part.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);
        const [, pre, core, post] = m;
        if (!core) return part;
        const upper = core.toUpperCase();
        if (KEEP_CAPS.has(upper)) return pre + upper + post;
        if (!allCaps && core.length >= 2 && core === upper && /[A-Z]/.test(core)) return part;
        const lower = core.toLowerCase();
        if (pi === 0 && !first && SMALL_WORDS.has(lower)) return pre + lower + post;
        const cased = allCaps ? lower.charAt(0).toUpperCase() + lower.slice(1) : core.charAt(0).toUpperCase() + core.slice(1);
        return pre + cased + post;
      })
      .join("-");
  });
  // "God" / "God's" / "God-Kind" → GOD; "Godly", "Godhead" are other words.
  return words.join(" ").replace(/\bgod(?=$|[^A-Za-z])/gi, "GOD");
}

/** Any title string (a series, or one saved earlier) in the house style. */
export function displayTitle(raw) {
  return smartTitle(decodeEntities(raw).replace(/\s+/g, " ").trim());
}

/**
 * The message's own title: the first "|" segment that isn't the channel tag
 * (later segments are the speaker/date suffix), whitespace collapsed, any
 * leading "<Series> Part N -" prefix stripped, house-style capitalization. The prefix
 * strip is greedy to the LAST "Part N -" occurrence, which also flattens
 * duplicated-prefix glitches in the data.
 */
export function cleanTitle(raw) {
  if (!raw) return "";
  const segments = decodeEntities(raw)
    .split("|")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const first = segments.find((s) => !CHANNEL_TAG.test(s)) || segments[0] || "";
  const stripped = first.replace(/^.*part\s*\d+\s*[-–—:]\s*/i, "").trim();
  return smartTitle(stripped || first);
}

// Title segments that are never the message's own name.
const SPEAKER_SEGMENT = /^(rev(erend)?\.?|pastor|apostle|bishop|dr\.?|prophet(ess)?|evangelist)\s/i;
const DATE_SEGMENT = /\b\d{1,2}\s*(st|nd|rd|th)?\s+[a-z]+,?\s+\d{4}\b/i;
const squash = (s) => decodeEntities(s || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]/g, "");

/**
 * A part's own name within its series. Event-style uploads repeat the series
 * in the first segment ("HERITAGE CAMP MEETING 2026 | DAY ONE MORNING | REV
 * PETER ALABI | 2ND SEPTEMBER 2026"), so cleanTitle() gives every part the
 * same name. This drops the channel tag, speaker, date and any segment that
 * just repeats the series title, and joins what's left: "Day One Morning",
 * "Tentmakers · Day Three Afternoon". Falls back to cleanTitle().
 */
export function partTitle(raw, seriesTitle) {
  if (!raw) return "";
  const series = squash(seriesTitle);
  const own = decodeEntities(raw)
    .split("|")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((s) => !CHANNEL_TAG.test(s) && !SPEAKER_SEGMENT.test(s) && !DATE_SEGMENT.test(s))
    .map((s) => s.replace(/^.*part\s*\d+\s*[-–—:]\s*/i, "").trim())
    .filter((s) => {
      const k = squash(s);
      return s && !(series && (k === series || (k.length >= 6 && series.startsWith(k))));
    });
  return own.length ? own.map(smartTitle).join(" · ") : cleanTitle(raw);
}

/** "Part N" label if the raw title carries one, else null. */
export function partLabel(raw) {
  const m = (raw || "").match(/part\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * The true preach date, parsed from the title tail (e.g. "| 19th August
 * 2026"), not `sermon_date` — that column is the YouTube upload date and
 * lags the service by 5-8 days on average (see memory:
 * sermon-date-is-upload-date). Returns null if the title carries no
 * recognizable date.
 */
export function parseSermonDate(raw) {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (month === undefined || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}
