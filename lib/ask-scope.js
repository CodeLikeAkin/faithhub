// lib/ask-scope.js
//
// Narrows an Ask the Word question to the messages it is about, when it names
// them. Two things a question can name that the search itself can never find:
//
//   - a PREACHER ("what did Pastor Eluwa teach…"). Names live only in the
//     YouTube title — nobody says their own name while preaching — and the
//     search only reads what was said. Asking about a guest used to search all
//     ~740 messages for the subject, miss his 3, and then tell the user he
//     wasn't in the library.
//   - a MESSAGE by its title ("what was Fully Persuaded about?", "Day 12",
//     "HCM 2026"). Same cause: titles are never searched.
//
// The Groq planner pulls the name/title out of the question AS THE USER WROTE
// IT (voice-typed, misspelled: "Elua", "Erua", "Oyemadey", "fun lola"); this
// file matches that against the real titles, deterministically, so the route
// can pass the matching sermon ids to match_segments_hybrid's filter.

import { detectSpeaker } from './speakers';
import { cleanTitle } from './titles';

const unescape = (t) => String(t || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** [{ id, title }] rows from `sermons` → what the matchers need. */
export function buildCatalog(rows) {
  return (rows || []).map((r) => {
    const title = unescape(r.title);
    return { id: r.id, title, clean: cleanTitle(title), speaker: detectSpeaker(title).name };
  });
}

// ── Names ────────────────────────────────────────────────────────────────────

// Words that come with a name but aren't part of it.
const NAME_NOISE = new Set([
  'pastor', 'pst', 'rev', 'revd', 'reverend', 'dr', 'doctor', 'apostle', 'prophet', 'prophetess',
  'evangelist', 'bishop', 'minister', 'guest', 'brother', 'sister', 'mr', 'mrs', 'the', 'of',
]);
// Shared by Rev. Peter and Pastor Funlola, so it can't pick one of them.
const SHARED_SURNAMES = new Set(['alabi']);
// Rev. Peter is the default speaker, so naming him narrows nothing. Checked
// on the words left after NAME_NOISE, so "Pastor Peter" doesn't fuzzy-match
// the guest Dr Flourish Peters.
const REV_PETER_WORDS = new Set(['peter', 'ayo', 'ayoalabi', 'alabi', 'dad', 'daddy', 'papa', 'baba']);
// What stewards call Pastor Funlola (see lib/voice.js). The planner is told to
// report these as "Pastor Funlola", but if one comes through as written it
// still has to narrow to her messages.
const FUNLOLA_WORDS = new Set(['mom', 'mommy', 'mum', 'mummy', 'mama', 'senior']);

// What a name sounds like, roughly, so speech-to-text spellings meet the real
// one: r/l swap (Erua → Eluwa), and w/y/h glides come and go (Elua, Oyemadey).
const skeleton = (w) => w.toLowerCase().replace(/[^a-z]/g, '').replace(/r/g, 'l').replace(/[wyh]/g, '');

function levenshtein(a, b) {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

// Does one spoken name-word match one real name-word?
function nameWordMatches(said, real) {
  const s = skeleton(said);
  const r = skeleton(real);
  if (s.length < 3 || r.length < 3) return false;
  if (s === r) return true;
  if (s.length >= 4 && r.startsWith(s)) return true; // "Gbemi" for Gbeminiyi
  return s.length >= 5 && levenshtein(s, r) <= 1;
}

/**
 * Match a preacher's name as the user wrote it against every non-Rev.-Peter
 * speaker in the catalog. Returns { name, ids } for the best match, or null —
 * including when the name means Rev. Peter himself (he's the default, so
 * there's nothing to narrow to).
 */
export function matchPreacher(said, catalog) {
  let words = String(said || '').toLowerCase().split(/[^a-z']+/).filter((w) => w && !NAME_NOISE.has(w));
  if (words.some((w) => FUNLOLA_WORDS.has(w))) words = ['funlola'];
  if (!words.length || words.includes('peter') || words.every((w) => REV_PETER_WORDS.has(w))) return null;
  // "fun lola" → also try "funlola"
  const tries = [...words];
  for (let i = 0; i < words.length - 1; i++) tries.push(words[i] + words[i + 1]);

  const bySpeaker = new Map();
  for (const s of catalog) {
    if (!s.speaker || s.speaker === 'Rev. Peter Alabi') continue;
    if (!bySpeaker.has(s.speaker)) bySpeaker.set(s.speaker, []);
    bySpeaker.get(s.speaker).push(s.id);
  }

  let best = [];
  let bestScore = 0;
  for (const [name, ids] of bySpeaker) {
    const parts = name.toLowerCase().split(/\s+/).filter((p) => !NAME_NOISE.has(p) && !SHARED_SURNAMES.has(p));
    const score = parts.filter((p) => tries.some((t) => nameWordMatches(t, p))).length;
    if (!score) continue;
    if (score > bestScore) { best = [{ name, ids }]; bestScore = score; }
    else if (score === bestScore) best.push({ name, ids });
  }
  if (!best.length) return null;
  return { name: best.map((b) => b.name).join(' / '), ids: best.flatMap((b) => b.ids) };
}

// ── Titles ───────────────────────────────────────────────────────────────────

const NUMBER_WORDS = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', first: '1', second: '2', third: '3', fourth: '4', fifth: '5',
  forty: '40', fourty: '40', fourtieth: '40', fortieth: '40',
};
const TITLE_NOISE = new Set([
  'the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'by', 'from', 'with', 'at', 'part', 'pt',
  'message', 'messages', 'sermon', 'sermons', 'series', 'teaching', 'teachings', 'preaching', 'his', 'her',
  'pastor', 'pst', 'rev', 'revd', 'dr', 'called', 'titled', 'named', 'one', 'that',
]);
// A name or event the question gives that matches more messages than this is
// a topic word that slipped through ("faith"), not a title — don't narrow.
const MAX_TITLE_MATCHES = 24;

function titleTokens(t) {
  return unescape(t)
    .toLowerCase()
    .replace(/(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => NUMBER_WORDS[w] || w);
}

function titleWordMatches(said, tokens) {
  if (/^\d+$/.test(said)) return tokens.includes(said); // numbers must be exact: Day 1 ≠ Day 12
  return tokens.some((t) => t === said || (said.length >= 5 && !/^\d+$/.test(t) && levenshtein(said, t) <= 1));
}

/**
 * Messages whose title contains every meaningful word of `said`
 * ("Fully Persuaded", "Godly Relationships part 2", "40 days day one 2024").
 * Returns [{ id, title }] or [] (no match, or too many to be a title).
 * `minWords` guards a whole question tried as a title: every word must be in
 * the title, so "how should I pray" can't match, but a one-word topic could.
 */
export function matchTitles(said, catalog, { minWords = 1 } = {}) {
  const want = titleTokens(said).filter((w) => !TITLE_NOISE.has(w));
  if (want.length < minWords) return [];
  const hits = catalog.filter((s) => {
    const tokens = titleTokens(s.title);
    return want.every((w) => titleWordMatches(w, tokens));
  });
  return hits.length > MAX_TITLE_MATCHES ? [] : hits;
}
