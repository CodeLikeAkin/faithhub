import { detectSpeaker } from "./speakers";

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
 * A series' display name: house style, minus any date, whether "(April 2026)"
 * or a trailing edition year ("HCM 2025"). The date belongs in the date line
 * beside the title, which shows month and year.
 */
export function seriesName(raw) {
  const named = displayTitle(raw);
  const bare = named
    .replace(/\s*\([^)]*\b(?:19|20)\d{2}\b[^)]*\)/g, "")
    .replace(/\s+(?:19|20)\d{2}$/, "")
    .trim();
  return bare || named;
}

const MONTH_NAMES =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
// Title segments that are never the message's own name.
const SPEAKER_SEGMENT = /^(rev(erend|'d|d)?\.?|pastor|pst\.?|apostle|bishop|dr\.?|prophet(ess)?|evangelist|bro|sis)\s/i;
const DATE_SEGMENT = new RegExp(String.raw`\b\d{1,2}\s*(st|nd|rd|th)?\s+${MONTH_NAMES}\.?,?\s+\d{4}\b`, "i");
const DAY_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten";
// A segment that is only an event slot: "Day 1 Morning", "DAY THREE", "DAY 3 - MORNING SESSION".
const SESSION_SEGMENT = new RegExp(
  String.raw`^day\s*(?:\d+|${DAY_WORDS})(?:\s*[-–—·]?\s*(?:morning|afternoon|evening|night)(?:\s+(?:session|service))?)?$`,
  "i"
);
const squash = (s) => decodeEntities(s || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]/g, "");
// "Heritage Camp Meeting 2026" → "hcm2026", so a segment reading "HCM 2026" counts as the series.
const acronym = (title) =>
  (decodeEntities(title || "").match(/[A-Za-z]+|\d+/g) || [])
    .map((w) => (/^\d/.test(w) ? w : w[0]))
    .join("")
    .toLowerCase();

// "DAY THREE - MORNING SESSION" → "Day 3 · Morning Session".
const DAY_NUMBER = Object.fromEntries(DAY_WORDS.split("|").map((w, i) => [w, String(i + 1)]));
const sessionLabel = (s) => {
  const m = s.match(new RegExp(String.raw`^day\s*(\d+|${DAY_WORDS})\s*[-–—·]?\s*(.*)$`, "i"));
  if (!m) return smartTitle(s);
  const day = DAY_NUMBER[m[1].toLowerCase()] || m[1];
  return `Day ${day}${m[2] ? ` · ${smartTitle(m[2])}` : ""}`;
};

const collapse = (s) => s.replace(/\s+/g, " ").trim();

/**
 * A raw title's segments. Most uploads separate them with "|"; a few use
 * spaced dashes instead ("Enlarged - (A Charge) - Day 1 Morning - HCM 2026 -
 * Pastor Funlola Alabi - 2nd September 2026"). Dashes only count as
 * separators when one of the segments is a date or a speaker, so a plain
 * "Series Part 1 - Message Name" is left for the part-prefix strip. A
 * parenthetical segment belongs to the one before it ("Enlarged (A Charge)").
 */
function segmentsOf(raw) {
  const text = decodeEntities(raw);
  let segs = text.split("|");
  if (segs.length === 1) {
    const dashed = text.split(/\s+[-–—]\s+/).map(collapse).filter(Boolean);
    if (dashed.slice(1).some((s) => DATE_SEGMENT.test(s) || SPEAKER_SEGMENT.test(s))) {
      segs = dashed.reduce((acc, s) => {
        if (s.startsWith("(") && acc.length) acc[acc.length - 1] += ` ${s}`;
        else acc.push(s);
        return acc;
      }, []);
    }
  }
  return segs.map(collapse).filter(Boolean);
}

/**
 * The message's own title: the first segment that isn't the channel tag
 * (later segments are the speaker/date suffix), whitespace collapsed, any
 * leading "<Series> Part N -" prefix stripped, house-style capitalization. The prefix
 * strip is greedy to the LAST "Part N -" occurrence, which also flattens
 * duplicated-prefix glitches in the data.
 */
export function cleanTitle(raw) {
  if (!raw) return "";
  const segments = segmentsOf(raw);
  const first = segments.find((s) => !CHANNEL_TAG.test(s)) || segments[0] || "";
  const stripped = first.replace(/^.*part\s*\d+\s*[-–—:]\s*/i, "").trim();
  return smartTitle(stripped || first);
}

// What's left of a raw title once the channel tag, speaker, date and any
// repeat of the series (in full, abbreviated, or as its acronym) are dropped.
function ownSegments(raw, seriesTitle) {
  const series = squash(seriesTitle);
  const abbr = acronym(seriesTitle);
  return segmentsOf(raw)
    .filter((s) => !CHANNEL_TAG.test(s) && !SPEAKER_SEGMENT.test(s) && !DATE_SEGMENT.test(s))
    .map((s) => s.replace(/^.*part\s*\d+\s*[-–—:]\s*/i, "").trim())
    .map((s) => (SESSION_SEGMENT.test(s) ? sessionLabel(s) : s))
    .filter((s) => {
      const k = squash(s);
      return s && !(series && (k === series || (k.length >= 6 && series.startsWith(k)) || (abbr.length >= 4 && k === abbr)));
    });
}

/**
 * A part's own name within its series. Event-style uploads repeat the series
 * in the first segment ("HERITAGE CAMP MEETING 2026 | DAY ONE MORNING | REV
 * PETER ALABI | 2ND SEPTEMBER 2026"), so cleanTitle() gives every part the
 * same name. This drops the channel tag, speaker, date and any segment that
 * just repeats the series title, and joins what's left: "Day One Morning",
 * "Tentmakers · Day Three Afternoon". Falls back to cleanTitle(). This is the
 * compact label for lists, the tab title and citations; the lesson header
 * uses parseTitle() to split the same pieces apart.
 */
export function partTitle(raw, seriesTitle) {
  if (!raw) return "";
  const own = ownSegments(raw, seriesTitle);
  return own.length ? own.map(smartTitle).join(" · ") : cleanTitle(raw);
}

/**
 * The pieces of a raw title, one per slot of the lesson header:
 *   name     the message's own name ("Enlarged (A Charge)"); when the upload
 *            has none, the event slot stands in for it
 *   session  the event slot ("Day 1 · Morning"), null if absent or used as name
 *   speaker  only when it isn't Rev. Peter Alabi (his are the default)
 *   date     the true preach date, from the title text, or null
 */
export function parseTitle(raw, seriesTitle) {
  const own = ownSegments(raw, seriesTitle);
  const sessions = own.filter((s) => SESSION_SEGMENT.test(s));
  const names = own.filter((s) => !SESSION_SEGMENT.test(s)).map(smartTitle);
  const { name: who } = detectSpeaker(raw);
  return {
    name: names.length ? names.join(" · ") : sessions[0] || cleanTitle(raw),
    session: names.length && sessions.length ? sessions.join(" · ") : null,
    speaker: who && who !== "Rev. Peter Alabi" ? who : null,
    date: parseSermonDate(raw),
  };
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

// Uploads shorten the month as often as they spell it out ("23RD AUG. 2024",
// "31ST JAN. 2024"). An explicit list, not a 3-letter prefix match, so an
// ordinary word can never be read as a month.
const MONTH_ABBR = {
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6,
  aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const monthIndex = (word) => {
  const k = word.toLowerCase();
  return MONTHS[k] !== undefined ? MONTHS[k] : MONTH_ABBR[k];
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
  // Case-insensitive: most uploads shout their dates ("2ND SEPTEMBER 2026"),
  // and a case-sensitive "st|nd|rd|th" used to miss every one of them.
  const m = raw.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = monthIndex(m[2]);
  const year = parseInt(m[3], 10);
  if (month === undefined || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}
