// Formatting helpers shared by every grounded-answer surface (Ask, the lesson
// Ask panel, the study document). Pure functions — safe on server and client.

import { bookIdFor, parseReference } from "./bible";

/** 754 -> "12:34", 3754 -> "1:02:34". */
export const fmtTime = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

export const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Strip markdown + citation markers (for copied studies / plain contexts). */
export const plainText = (t) =>
  (t || "").replace(/\*\*/g, "").replace(/\[\d+\]/g, "").replace(/[ \t]+/g, " ").trim();

/** Auto-name a study from its first question. */
export const titleFrom = (q) => {
  const t = q
    .replace(
      /^\s*(what|how|why|when|where|who)\s+(does|do|did|should|can|is|are)\s+(rev\.?\s*peter\s+)?((teach(es)?|says?|said)\s+(about|that|us|on)?\s*)?/i,
      ""
    )
    .replace(/\?+\s*$/, "")
    .trim();
  const s = t.length > 3 ? t[0].toUpperCase() + t.slice(1) : q.replace(/\?+\s*$/, "");
  return s.length > 46 ? `${s.slice(0, 46).trimEnd()}…` : s;
};

// ── Scripture references in answer prose ─────────────────────────────────────
const BIBLE_BOOKS =
  "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation";

// Lookbehinds keep "Rev. Peter" from matching as the book of Peter.
export const SCRIPTURE_RE = new RegExp(
  `(?<!Rev\\.\\s)(?<!Rev\\s)\\b(?:[1-3]\\s)?(?:${BIBLE_BOOKS})\\s\\d+(?::\\d+(?:[-–]\\d+)?)?\\b`,
  "g"
);

/** Unique scripture references in first-seen order ("Romans 10:17", "John 3"). */
export const extractScriptures = (text) => {
  const re = new RegExp(SCRIPTURE_RE.source, "g");
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(text || ""))) {
    const v = m[0].replace(/\s+/g, " ");
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
};

/**
 * parseReference() only understands "Book C:V(-V)". Answers also name whole
 * chapters ("Romans 8"), so fall back to a chapter-only parse — the caller
 * decides how much of a chapter is worth showing.
 */
export function parseScriptureRef(ref) {
  const full = parseReference(ref);
  if (full) return full;
  const m = (ref || "").trim().match(/^((?:[123]\s*)?[A-Za-z][A-Za-z .]*?)\s+(\d+)$/);
  if (!m) return null;
  const bookId = bookIdFor(m[1]);
  if (!bookId) return null;
  return { book: m[1].trim(), bookId, chapter: Number(m[2]), wholeChapter: true };
}
