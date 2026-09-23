import WordLanding from "@/components/word/WordLanding";
import { supabase } from "@/lib/supabase";
import { bookIdFor } from "@/lib/bible";
import { bookFromId, passageLabel } from "@/lib/canon";

export const metadata = { title: "The Word · FaithHub" };

// The landing needs every reference (~20k rows) to rank passages. Do it on
// the server and cache it for an hour instead of shipping the rows to every
// phone that opens the page.
export const revalidate = 3600;

async function landingStats() {
  try {
    const { count, error } = await supabase.from("sermon_scriptures").select("id", { count: "exact", head: true });
    if (error || !count) return null;
    const pages = await Promise.all(
      Array.from({ length: Math.ceil(count / 1000) }, (_, p) =>
        supabase
          .from("sermon_scriptures")
          .select("book, book_id, chapter, verse_start, verse_end, sermon_id")
          .order("id")
          .range(p * 1000, p * 1000 + 999)
      )
    );
    if (pages.some((p) => p.error)) return null;
    const rows = pages.flatMap((p) => p.data || []);

    const messages = new Set();
    const passages = new Map();
    const chapters = new Map();
    const books = new Map();
    const bump = (map, key, init, sermonId) => {
      let e = map.get(key);
      if (!e) map.set(key, (e = { ...init, refs: 0, sermons: new Set() }));
      e.refs += 1;
      e.sermons.add(sermonId);
    };

    for (const r of rows) {
      const id = r.book_id || bookIdFor(r.book);
      const book = bookFromId(id);
      if (!book || !r.chapter) continue;
      messages.add(r.sermon_id);
      bump(books, id, { id }, r.sermon_id);
      bump(chapters, `${id}|${r.chapter}`, { id, chapter: r.chapter }, r.sermon_id);
      if (r.verse_start) {
        bump(
          passages,
          `${id}|${r.chapter}|${r.verse_start}|${r.verse_end || r.verse_start}`,
          { id, chapter: r.chapter, verseStart: r.verse_start, verseEnd: r.verse_end || r.verse_start },
          r.sermon_id
        );
      }
    }

    const top = (map, n) =>
      [...map.values()].sort((a, b) => b.sermons.size - a.sermons.size || b.refs - a.refs).slice(0, n);
    const withBook = ({ sermons, ...e }) => {
      const b = bookFromId(e.id);
      return { ...e, messages: sermons.size, name: b.name, slug: b.slug };
    };

    return {
      totals: { refs: rows.length, messages: messages.size, books: books.size },
      passages: top(passages, 8).map((e) => ({
        ...withBook(e),
        label: passageLabel(bookFromId(e.id).name, e.chapter, e.verseStart, e.verseEnd),
      })),
      chapters: top(chapters, 6).map(withBook),
      books: top(books, 8).map(withBook),
    };
  } catch {
    return null; // the view falls back to the Bible navigator alone
  }
}

export default async function WordPage() {
  const stats = await landingStats();
  return <WordLanding stats={stats} />;
}
