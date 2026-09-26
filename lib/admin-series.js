// lib/admin-series.js
//
// Series rules for the admin console, kept IDENTICAL to the pipeline's so the
// page and the pipeline never disagree:
//   - matchSeries(): pipeline stage 2's rule (run-pipeline.js matchSeries) -
//     the longest existing series title that appears inside the sermon title.
//   - proposeSeries() and friends: a verbatim ESM port of
//     .claude/faithhub-pipeline/lib/propose-series.js (deterministic grouping
//     of orphaned sermons into NEW series; proposes, never deletes).
// If either rule changes in the pipeline, change it here too.

/** Stage 2's rule: longest series title (4+ chars) found inside the sermon title. */
export function matchSeries(sermonTitle, seriesList) {
  const t = String(sermonTitle || '').toLowerCase();
  let best = null;
  for (const s of seriesList) {
    const st = (s.title || '').toLowerCase().trim();
    if (st.length < 4 || !t.includes(st)) continue;
    if (!best || st.length > best.title.toLowerCase().length) best = s;
  }
  return best;
}

const loose = (s) =>
  ` ${String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
const withoutThe = (s) => s.replace(/^ the /, ' ');

/**
 * Admin-page-only fallback when stage 2's exact rule finds nothing: compare
 * with punctuation and a leading "The" ignored, whole words only. Catches
 * "HOFCHURCHGLOBAL |BOOK OF EPHESIANS |..." for "The Book of Ephesians", which
 * the exact rule (and so the pipeline) misses. Only ever a SUGGESTION the
 * admin confirms; the pipeline itself is unchanged.
 */
export function closeMatchSeries(sermonTitle, seriesList) {
  const t = loose(sermonTitle);
  let best = null;
  let bestLen = 0;
  for (const s of seriesList) {
    const st = withoutThe(loose(s.title));
    const len = st.trim().length;
    if (len < 8 || !t.includes(st)) continue;
    if (len > bestLen) {
      best = s;
      bestLen = len;
    }
  }
  return best;
}

// ─── Port of lib/propose-series.js below (unchanged logic) ─────────────────
// Titles are pipe-delimited and the segment order varies:
//   "The Book of Ephesians - Part 15 | Rev Peter Alabi | 5th August 2026"
//   "HOFCHURCHNG | DAY ONE MORNING | THE GLORY CLOUD | REV PETER ALABI | 29TH JUNE 2026"
// The subject is what is left once the speaker, the date and the service/channel
// boilerplate are removed.

// "Revd" and "Rev'd" are both used on this channel and neither matches a plain
// \brev\b — missing them left the speaker glued onto the stem, which split the
// 2022 "40DOT" run into two separate proposals.
const SPEAKER_RE =
  /\b(rev(\.|'d|d)?|pastor|pst\.?|dr\.?|apostle|bishop|evang(elist)?\.?|prophet|minister)\b/i;

// Allows "4th of July, 2022" and "30th Jan. 2024" as well as "5th August 2026".
const DATE_RE = /(\d{1,2})\s*(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)\.?,?\s+(\d{4})/i;

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8,
  oct: 9, nov: 10, dec: 11,
};

// Channel handles and service boilerplate — never part of a series name.
const BOILERPLATE_RE =
  /^(hofchurch\w*|hof|heritage of faith( church)?|live|streaming live.*|)$/i;

const SERVICE_RE =
  /\b((1st|2nd|3rd|first|second|third)\s+service|sunday\s+service|midweek\s+service|(prophetic|apostolic)\s+midweek(\s+service)?|special\s+(sunday\s+)?service|communion\s+service|(morning|evening|afternoon)\s+(service|session))\b/i;

// The church's own part markers. Written as one alternation so the same list
// both strips the marker from the stem AND proves the cluster is a series.
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const PART_RE =
  /\b(?:part|pt\.?|day|week|session)\s*[-–—]?\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;

const TRAILING_NUM_RE = /[\s:–—-]+(\d{1,3})\s*$/; // "Witnesses 2", "Angels and Demons 4"

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

/**
 * The real preach date, read from the title. Do NOT use sermons.sermon_date for
 * ordering: it is YouTube's publishedAt (the upload date), which lags the
 * service by 5–8 days and disagrees with the title for ~65% of the corpus.
 */
export function parseTitleDate(title) {
  const m = DATE_RE.exec(decodeEntities(title));
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  const d = new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
  if (isNaN(d) || d.getUTCDate() !== Number(m[1])) return null;
  return d;
}

/** The explicit part number the church put in the title, or null. */
export function parsePartNumber(title) {
  const t = decodeEntities(title);
  const m = PART_RE.exec(t);
  if (m) {
    const raw = m[1].toLowerCase();
    return WORD_NUMBERS[raw] || parseInt(raw, 10) || null;
  }
  const trailing = TRAILING_NUM_RE.exec(stripNoise(t));
  if (trailing) {
    const n = parseInt(trailing[1], 10);
    // A year is not a part number.
    if (n >= 1 && n <= 100) return n;
  }
  return null;
}

function stripNoise(segment) {
  return segment
    .replace(DATE_RE, ' ')
    .replace(SERVICE_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Everything in the title that is neither speaker, date, nor boilerplate. */
export function subjectOf(title) {
  const parts = decodeEntities(title).split('|');
  const kept = [];
  for (const raw of parts) {
    const seg = raw.trim();
    if (!seg) continue;
    if (BOILERPLATE_RE.test(seg)) continue;
    if (SPEAKER_RE.test(seg)) continue;            // speaker segment
    const cleaned = stripNoise(seg);
    if (!cleaned) continue;                        // was only a date / service label
    kept.push(cleaned);
  }
  return kept.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/** The subject with the part marker removed — the candidate series name. */
export function stemOf(title) {
  let s = subjectOf(title)
    .replace(new RegExp('[-–—:]?\\s*' + PART_RE.source, 'gi'), ' ')
    .replace(/\b(morning|evening|afternoon)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(TRAILING_NUM_RE, '')
    .replace(/[\s:–—-]+$/, '')
    .trim();
  return s;
}

export function normaliseKey(stem) {
  return stem.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// Names the church writes as acronyms, which must survive title-casing —
// they are also what future uploads will say, and stage 2 matches on the
// series title as a literal substring.
const ACRONYMS = new Set(['YMTS', 'HOF', 'RFC', 'HCM', 'QNA', 'GO', 'YE', 'GOD']);
const MINOR = /^(of|the|and|in|to|for|a|an|on|at|by|with)$/;

/** Title Case for a stem that arrived SHOUTING, left alone otherwise. */
function presentableTitle(stem) {
  const letters = stem.replace(/[^A-Za-z]/g, '');
  if (!letters) return stem;
  const upper = (stem.match(/[A-Z]/g) || []).length / letters.length;
  if (upper < 0.8) return stem; // already mixed case — the church's own styling

  return stem
    .split(/(\s+)/)
    .map((tok, i) => {
      if (/^\s+$/.test(tok) || !tok) return tok;
      const bare = tok.replace(/[^A-Za-z0-9]/g, '');
      // "40DOT" — a digit/letter blend is a name, not a word.
      if (/\d/.test(bare) && /[A-Za-z]/.test(bare)) return tok;
      if (ACRONYMS.has(bare.toUpperCase())) return tok.toUpperCase();
      const lower = tok.toLowerCase();
      if (i > 0 && MINOR.test(lower.replace(/[^a-z]/g, ''))) return lower;
      return lower.replace(/[a-z]/, (c) => c.toUpperCase());
    })
    .join('');
}

/**
 * Cluster orphaned sermons into proposed series.
 *
 * @param {Array<{id,title,sermon_date}>} orphans  sermons matching no existing series
 * @param {Array<{title}>} existingSeries          so we never re-propose one that exists
 * @returns {{confident: Proposal[], possible: Proposal[], skipped: number}}
 */
export function proposeSeries(orphans, existingSeries = []) {
  const existingKeys = new Set(existingSeries.map((s) => normaliseKey(s.title || '')));

  const clusters = new Map(); // key -> { stem, members[] }
  let skipped = 0;

  for (const s of orphans) {
    const stem = stemOf(s.title);
    const key = normaliseKey(stem);
    // An empty stem means the title was nothing but channel, service and date —
    // a weekly service upload, not a series.
    if (!key) { skipped++; continue; }
    if (existingKeys.has(key)) { skipped++; continue; }
    if (!clusters.has(key)) clusters.set(key, { stem, members: [] });
    clusters.get(key).members.push({
      ...s,
      part: parsePartNumber(s.title),
      preached: parseTitleDate(s.title),
    });
  }

  const confident = [];
  const possible = [];

  for (const [key, { stem, members }] of clusters) {
    if (members.length < 2) { skipped++; continue; }
    // A one-word stem is usually too generic to group on ("Meditation",
    // "Life") — unless the church numbered several of them, which is what
    // makes a name like "40DOT" a real series rather than a coincidence.
    const numberedCount = members.filter((m) => m.part).length;
    if (key.split(' ').length < 2 && numberedCount < 3) { skipped++; continue; }

    // Order by the real preach date; fall back to upload date, then title.
    members.sort((a, b) => {
      const ad = a.preached ? a.preached.getTime() : null;
      const bd = b.preached ? b.preached.getTime() : null;
      if (ad !== null && bd !== null && ad !== bd) return ad - bd;
      const au = a.sermon_date || '';
      const bu = b.sermon_date || '';
      if (au !== bu) return au < bu ? -1 : 1;
      return String(a.title).localeCompare(String(b.title));
    });

    // Explicit numbering wins; anything unnumbered fills the next free slot.
    const taken = new Set(members.map((m) => m.part).filter(Boolean));
    let next = 1;
    const parts = members.map((m) => {
      if (m.part) return { ...m, part_number: m.part, explicit: true };
      while (taken.has(next)) next++;
      taken.add(next);
      return { ...m, part_number: next, explicit: false };
    });

    const counts = {};
    for (const p of parts) counts[p.part_number] = (counts[p.part_number] || 0) + 1;
    const collisions = Object.entries(counts).filter(([, n]) => n > 1).map(([p]) => Number(p));

    const dates = parts.map((p) => p.sermon_date).filter(Boolean).sort();
    const proposal = {
      title: presentableTitle(stem),
      stem,
      key,
      parts,
      numbered: parts.filter((p) => p.explicit).length,
      collisions,
      start_date: dates[0] || null,
      end_date: dates[dates.length - 1] || null,
      total_parts: Math.max(...parts.map((p) => p.part_number)),
    };

    // The church numbering a message is what separates "a series" from "two
    // sermons that happen to share words".
    if (proposal.numbered > 0) confident.push(proposal);
    else possible.push(proposal);
  }

  const bySize = (a, b) => b.parts.length - a.parts.length || a.title.localeCompare(b.title);
  confident.sort(bySize);
  possible.sort(bySize);
  annotate(confident, existingSeries);
  annotate(possible, existingSeries);
  return { confident, possible, skipped };
}

/**
 * Add "look at these together" notes. Deliberately advisory, never automatic:
 * a sub-titled instalment ("THE ANOINTING | DAY 31 | 40 DAYS OF TRANSFORMATION
 * 2024") really does belong to the bigger run, but a Q&A session sharing the
 * same programme name may or may not, and merging the wrong pair silently would
 * put the wrong messages in front of someone studying.
 */
function annotate(proposals, existingSeries) {
  const contains = (haystack, needle) =>
    haystack === needle || new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(haystack);

  for (const p of proposals) {
    p.notes = [];
    for (const other of proposals) {
      if (other === p) continue;
      // Only a specific stem is worth folding into — 3+ words.
      if (other.key.split(' ').length < 3) continue;
      if (contains(p.key, other.key) && other.parts.length >= p.parts.length) {
        p.notes.push(`shares the stem of "${other.title}", consider merging`);
      }
    }
    for (const s of existingSeries) {
      const k = normaliseKey(s.title || '');
      if (!k || k === p.key) continue;
      if (contains(k, p.key) || contains(p.key, k)) {
        p.notes.push(`an existing series is named "${s.title}", which may be a new instalment of it`);
      }
    }
  }
}
