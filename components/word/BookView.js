"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { bookFromSlug, passageLabel, sectionFor } from "@/lib/canon";
import { loadBookRows, loadBookStats, useLoad } from "@/lib/word-data";
import { cleanTitle, parseSermonDate } from "@/lib/titles";

const MESSAGES_PREVIEW = 24; // 200+ messages open the big books — don't load 200 thumbnails at once

const sermonDate = (s) => {
  const d = parseSermonDate(s?.title) || (s?.sermon_date ? new Date(s.sermon_date) : null);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
};

export function AllBooksLink() {
  return (
    <Link href="/word" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:underline xl:hidden">
      <ArrowLeft size={14} aria-hidden="true" /> All books
    </Link>
  );
}

/** The chapters of a book as a bar chart — each bar opens that chapter. */
function ChapterChart({ book, chapters }) {
  const max = Math.max(1, ...chapters.map((c) => c.messages));
  const every = book.chapters <= 30 ? 1 : book.chapters <= 70 ? 5 : 10;
  const minWidth = book.chapters * 12;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 custom-scrollbar sm:mx-0 sm:px-0">
      <div style={{ minWidth }}>
        <div className="flex h-44 items-end gap-[3px]">
          {chapters.map((c, i) => (
            <Link
              key={i}
              href={`/word/${book.slug}/${i + 1}`}
              aria-label={`Chapter ${i + 1}: ${c.messages ? `${c.messages} messages` : "not preached yet"}`}
              title={`Chapter ${i + 1} · ${c.messages} messages`}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end focus-visible:outline-none"
            >
              <span
                className={
                  c.messages
                    ? "block w-full rounded-t-md bg-brand-navy/70 transition-colors group-hover:bg-brand-navy group-focus-visible:bg-brand-navy"
                    : "block h-0.5 w-full rounded-full bg-brand-navy/15"
                }
                style={c.messages ? { height: `${Math.max(4, (c.messages / max) * 100)}%` } : undefined}
              />
            </Link>
          ))}
        </div>
        <div aria-hidden="true" className="mt-2 flex gap-[3px] border-t border-brand-navy/10 pt-1.5">
          {chapters.map((_, i) => (
            <span key={i} className="min-w-0 flex-1 text-center text-xs tabular-nums text-brand-gray">
              {(i + 1) % every === 0 || i === 0 ? i + 1 : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** /word/[book] — one book: its chapters, most-opened passages, and the messages that open it. */
export default function BookView({ slug }) {
  const book = bookFromSlug(slug);
  const { data: stats } = useLoad(loadBookStats, []);
  const { data: rows, error, loading } = useLoad(() => (book ? loadBookRows(book.id) : []), [book?.id]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (book) document.title = `${book.name} · The Word`;
  }, [book]);

  const view = useMemo(() => {
    if (!book || !rows) return null;
    const chapters = Array.from({ length: book.chapters }, () => ({ refs: 0, sermons: new Set() }));
    const passages = new Map();
    const bySermon = new Map();
    for (const r of rows) {
      const c = chapters[r.chapter - 1];
      if (c) {
        c.refs += 1;
        if (r.sermon?.id) c.sermons.add(r.sermon.id);
      }
      if (r.verse_start) {
        const key = `${r.chapter}|${r.verse_start}|${r.verse_end || r.verse_start}`;
        let p = passages.get(key);
        if (!p) passages.set(key, (p = { chapter: r.chapter, vs: r.verse_start, ve: r.verse_end || r.verse_start, sermons: new Set() }));
        if (r.sermon?.id) p.sermons.add(r.sermon.id);
      }
      if (r.sermon?.id) {
        let s = bySermon.get(r.sermon.id);
        if (!s) bySermon.set(r.sermon.id, (s = { sermon: r.sermon, refs: 0 }));
        s.refs += 1;
      }
    }
    return {
      chapters: chapters.map((c) => ({ refs: c.refs, messages: c.sermons.size })),
      passages: [...passages.values()]
        .sort((a, b) => b.sermons.size - a.sermons.size)
        .slice(0, 6)
        .map((p) => ({ ...p, messages: p.sermons.size, label: passageLabel(book.name, p.chapter, p.vs, p.ve) })),
      messages: [...bySermon.values()].sort((a, b) => b.refs - a.refs),
    };
  }, [book, rows]);

  if (!book) {
    return (
      <div className="px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-medium text-brand-ink">We couldn&rsquo;t find that book</h1>
        <Link href="/word" className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-navy hover:underline">
          Back to The Word <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const s = stats?.[book.id];
  const maxPassage = Math.max(1, ...(view?.passages || []).map((p) => p.messages));
  const shownMessages = view ? (showAll ? view.messages : view.messages.slice(0, MESSAGES_PREVIEW)) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      <AllBooksLink />
      <header className="mt-4 xl:mt-0">
        <p className="text-sm text-brand-gray">{sectionFor(book)?.name}</p>
        <h1 className="mt-1 font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">{book.name}</h1>
        <p className="mt-3 text-lg text-brand-gray">
          {s
            ? `Opened in ${s.sermons.toLocaleString()} messages · ${s.refs.toLocaleString()} references`
            : stats
            ? "Rev. Peter hasn’t preached from this book in the messages indexed so far."
            : " "}
        </p>
      </header>

      {loading && !rows && (
        <div aria-hidden="true" className="mt-10 flex h-44 items-end gap-1">
          {Array.from({ length: Math.min(book.chapters, 40) }, (_, i) => (
            <span key={i} className="flex-1 rounded-t-md bg-brand-sky motion-safe:animate-pulse" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
          ))}
        </div>
      )}
      {error && <p className="mt-10 text-sm text-brand-gray">Couldn&rsquo;t load this book&rsquo;s references just now.</p>}

      {view && (
        <>
          <section aria-labelledby="chapters-heading" className="pt-12">
            <h2 id="chapters-heading" className="font-display text-2xl font-medium tracking-tight text-brand-ink sm:text-3xl">
              Chapters
            </h2>
            <p className="mt-1.5 text-sm text-brand-gray">How many messages open each chapter — tap a bar to read it with them</p>
            <div className="mt-6">
              <ChapterChart book={book} chapters={view.chapters} />
            </div>
          </section>

          {view.passages.length > 0 && (
            <section aria-labelledby="passages-heading" className="pt-12">
              <h2 id="passages-heading" className="font-display text-2xl font-medium tracking-tight text-brand-ink sm:text-3xl">
                Most-opened passages
              </h2>
              <ul className="mt-5 space-y-1.5">
                {view.passages.map((p) => (
                  <li key={p.label}>
                    <Link
                      href={`/word/${book.slug}/${p.chapter}#v${p.vs}`}
                      className="group grid grid-cols-[8.5rem_1fr_auto] items-center gap-4 rounded-xl px-2 py-2 transition-colors hover:bg-brand-sky/60 sm:grid-cols-[11rem_1fr_auto]"
                    >
                      <span className="font-semibold text-brand-navy">{p.label}</span>
                      <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-brand-navy/[0.06]">
                        <span className="block h-full rounded-full bg-brand-navy/60 group-hover:bg-brand-navy" style={{ width: `${(p.messages / maxPassage) * 100}%` }} />
                      </span>
                      <span className="text-sm tabular-nums text-brand-gray">{p.messages} messages</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.messages.length > 0 && (
            <section aria-labelledby="messages-heading" className="pt-12">
              <h2 id="messages-heading" className="font-display text-2xl font-medium tracking-tight text-brand-ink sm:text-3xl">
                Messages that open {book.name}
              </h2>
              <p className="mt-1.5 text-sm text-brand-gray">Most references first</p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {shownMessages.map(({ sermon, refs }) => (
                  <li key={sermon.id}>
                    <Link
                      href={`/sermon/${sermon.id}#scriptures`}
                      className="group flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-white p-2.5 pr-4 transition-[border-color,box-shadow] hover:border-brand-navy/25 hover:shadow-[0_20px_40px_-30px_rgba(23,58,104,0.45)]"
                    >
                      <span className="relative aspect-video w-24 flex-shrink-0 overflow-hidden rounded-xl bg-brand-sky">
                        {sermon.youtube_video_id && (
                          <img
                            src={`https://img.youtube.com/vi/${sermon.youtube_video_id}/mqdefault.jpg`}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-semibold leading-snug text-brand-ink group-hover:text-brand-navy">
                          {cleanTitle(sermon.title)}
                        </span>
                        <span className="mt-0.5 block text-xs text-brand-gray">
                          {[sermonDate(sermon), `${refs} ${refs === 1 ? "reference" : "references"}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {view.messages.length > MESSAGES_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-5 rounded-full border border-brand-navy/15 px-5 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-sky"
                >
                  {showAll ? "Show fewer" : `Show all ${view.messages.length} messages`}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
