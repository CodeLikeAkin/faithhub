// The shape of the Bible for The Word: canon sections, chapter counts, and
// URL slugs ("1 Corinthians" ↔ "1-corinthians"). Book ids come from
// lib/bible.js bookIdFor() — sermon_scriptures rows are grouped by book_id,
// because the stored book names vary ("Psalm" / "Psalms").

import { BOOK_ORDER, bookIdFor } from "./bible";

const CHAPTERS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1,
  4, 7, 3, 3, 3, 2, 14, 4, // Malachi
  28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22, // Revelation
];

// [name, first book, last book, short range label]
const SECTION_RANGES = [
  ["Law", "Genesis", "Deuteronomy", "Genesis to Deuteronomy"],
  ["History", "Joshua", "Esther", "Joshua to Esther"],
  ["Poetry", "Job", "Song of Solomon", "Job to the Song of Solomon"],
  ["Prophets", "Isaiah", "Malachi", "Isaiah to Malachi"],
  ["Gospels", "Matthew", "Acts", "Matthew to Acts"],
  ["Epistles", "Romans", "Revelation", "Romans to Revelation"],
];

export const slugFor = (name) => name.toLowerCase().replace(/\s+/g, "-");

export const BOOKS = BOOK_ORDER.map((name, i) => ({
  name,
  id: bookIdFor(name),
  slug: slugFor(name),
  chapters: CHAPTERS[i],
  index: i,
}));

const bySlug = new Map(BOOKS.map((b) => [b.slug, b]));
const byId = new Map(BOOKS.map((b) => [b.id, b]));

export const bookFromSlug = (slug) => (slug ? bySlug.get(String(slug).toLowerCase()) || null : null);
export const bookFromId = (id) => byId.get(id) || null;

export const SECTIONS = SECTION_RANGES.map(([name, first, last, range]) => {
  const a = BOOK_ORDER.indexOf(first);
  const b = BOOK_ORDER.indexOf(last);
  return { name, range, books: BOOKS.slice(a, b + 1) };
});

export const sectionFor = (book) => SECTIONS.find((s) => s.books.some((b) => b.id === book?.id)) || null;

/** "Romans 8:28", "Romans 8:28-30", "Romans 8". */
export function passageLabel(bookName, chapter, verseStart, verseEnd) {
  let label = `${bookName} ${chapter}`;
  if (verseStart) {
    label += `:${verseStart}`;
    if (verseEnd && verseEnd !== verseStart) label += `–${verseEnd}`;
  }
  return label;
}
