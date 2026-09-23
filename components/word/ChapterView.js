"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import VideoModal from "@/components/VideoModal";
import { TranslationToggle } from "@/components/VerseCard";
import { bookFromSlug, passageLabel } from "@/lib/canon";
import { loadBookRows, loadChapterText, useLoad } from "@/lib/word-data";
import { cleanTitle, parseSermonDate } from "@/lib/titles";
import { fmtTime } from "@/lib/ask-format";
import { scrollToElement } from "@/lib/scroll";
import { AllBooksLink } from "./BookView";

const MESSAGES_PER_PASSAGE = 5;
const MAX_VERSES = 8; // a long range shows its opening verses

const sermonDate = (s) => {
  const d = parseSermonDate(s?.title) || (s?.sermon_date ? new Date(s.sermon_date) : null);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
};

function Passage({ book, group, text, onWatch }) {
  const [showAll, setShowAll] = useState(false);
  const verses = [];
  if (text) {
    const from = group.vs || 1;
    const to = group.vs ? Math.min(group.ve, from + MAX_VERSES - 1) : Math.min(3, text.size);
    for (let v = from; v <= to; v++) if (text.has(v)) verses.push([v, text.get(v)]);
  }
  const trimmed = group.vs ? group.ve - group.vs + 1 > MAX_VERSES : true;
  const shown = showAll ? group.messages : group.messages.slice(0, MESSAGES_PER_PASSAGE);

  return (
    <article id={group.vs ? `v${group.vs}` : "whole"} className="scroll-mt-6 border-t border-brand-navy/10 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-brand-navy">
          {group.vs ? passageLabel(book.name, group.chapter, group.vs, group.ve) : `${book.name} ${group.chapter} — the whole chapter`}
        </h2>
        <span className="text-sm tabular-nums text-brand-gray">
          {group.messages.length} {group.messages.length === 1 ? "message" : "messages"}
        </span>
      </header>

      {verses.length > 0 && (
        <blockquote className="mt-3 font-display text-xl leading-relaxed text-brand-ink">
          {verses.map(([n, t]) => (
            <span key={n}>
              <sup className="mr-1 font-sans text-xs font-bold text-brand-navy/50">{n}</sup>
              {t}{" "}
            </span>
          ))}
          {trimmed && <span className="text-brand-gray">…</span>}
        </blockquote>
      )}

      <ul className="mt-5 divide-y divide-brand-navy/10 rounded-2xl border border-brand-navy/10">
        {shown.map(({ sermon, ts, theme }) => (
          <li key={sermon.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-brand-ink">{cleanTitle(sermon.title)}</p>
              <p className="mt-0.5 text-xs text-brand-gray">{sermonDate(sermon)}</p>
              {theme && <p className="mt-1.5 text-sm text-brand-ink/75">Why he read it: {theme}</p>}
            </div>
            <div className="flex flex-shrink-0 gap-2">
              {sermon.youtube_video_id && (
                <button
                  type="button"
                  onClick={() =>
                    onWatch({ video_id: sermon.youtube_video_id, start_seconds: ts || 0, sermon_title: sermon.title })
                  }
                  aria-label={ts != null ? `Watch at ${fmtTime(ts)}` : "Watch the message"}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-navy px-3.5 text-sm font-semibold tabular-nums text-white transition-colors hover:bg-brand-deep"
                >
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                  {ts != null ? fmtTime(ts) : "Watch"}
                </button>
              )}
              <Link
                href={`/sermon/${sermon.id}${ts != null ? `?t=${Math.floor(ts)}` : ""}`}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-brand-navy/15 px-3.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-sky"
              >
                Lesson <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {group.messages.length > MESSAGES_PER_PASSAGE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-semibold text-brand-navy hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${group.messages.length} messages`}
        </button>
      )}
    </article>
  );
}

/** /word/[book]/[chapter] — every passage of a chapter he opened, with its text and the moments. */
export default function ChapterView({ slug, chapter }) {
  const book = bookFromSlug(slug);
  const ch = parseInt(chapter, 10);
  const valid = book && ch >= 1 && ch <= book.chapters;
  const [translation, setTranslation] = useState("KJV");
  const [watching, setWatching] = useState(null);
  const { data: rows, loading } = useLoad(() => (valid ? loadBookRows(book.id) : []), [book?.id, valid]);
  const { data: text } = useLoad(() => (valid ? loadChapterText(book, ch, translation) : null), [book?.id, ch, translation]);

  useEffect(() => {
    if (valid) document.title = `${book.name} ${ch} · The Word`;
  }, [valid, book, ch]);

  const groups = useMemo(() => {
    if (!valid || !rows) return null;
    const map = new Map();
    for (const r of rows) {
      if (r.chapter !== ch || !r.sermon?.id) continue;
      const vs = r.verse_start || null;
      const ve = r.verse_start ? r.verse_end || r.verse_start : null;
      const key = `${vs}|${ve}`;
      let g = map.get(key);
      if (!g) map.set(key, (g = { chapter: ch, vs, ve, bySermon: new Map() }));
      // One line per message: its earliest moment on this passage.
      const prev = g.bySermon.get(r.sermon.id);
      if (!prev || (r.timestamp_seconds ?? Infinity) < (prev.ts ?? Infinity)) {
        g.bySermon.set(r.sermon.id, { sermon: r.sermon, ts: r.timestamp_seconds ?? null, theme: r.theme || prev?.theme || null });
      }
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        messages: [...g.bySermon.values()].sort(
          (a, b) => (parseSermonDate(b.sermon.title)?.getTime() || 0) - (parseSermonDate(a.sermon.title)?.getTime() || 0)
        ),
      }))
      .sort((a, b) => (a.vs ?? 0) - (b.vs ?? 0) || (a.ve ?? 0) - (b.ve ?? 0));
  }, [valid, rows, ch]);

  const messageCount = useMemo(
    () => (groups ? new Set(groups.flatMap((g) => g.messages.map((m) => m.sermon.id))).size : 0),
    [groups]
  );

  // Arriving at #v28: bring the passage that holds verse 28 into view.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !groups?.length) return;
    const m = window.location.hash.match(/^#v(\d+)$/);
    if (!m) return;
    jumped.current = true;
    const verse = Number(m[1]);
    const g = groups.find((x) => x.vs && x.vs <= verse && verse <= x.ve) || groups.find((x) => x.vs === verse);
    const el = g && document.getElementById(`v${g.vs}`);
    if (el) setTimeout(() => scrollToElement(el, { offset: 16, smooth: false }), 60);
  }, [groups]);

  if (!valid) {
    return (
      <div className="px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-medium text-brand-ink">That chapter doesn&rsquo;t exist</h1>
        <Link href={book ? `/word/${book.slug}` : "/word"} className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-navy hover:underline">
          {book ? `Back to ${book.name}` : "Back to The Word"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const pager = (
    <div className="flex items-center gap-2">
      {ch > 1 ? (
        <Link
          href={`/word/${book.slug}/${ch - 1}`}
          aria-label={`${book.name} ${ch - 1}`}
          className="grid h-10 w-10 place-items-center rounded-full border border-brand-navy/15 text-brand-navy hover:bg-brand-sky"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
      ) : (
        <span className="h-10 w-10" />
      )}
      {ch < book.chapters && (
        <Link
          href={`/word/${book.slug}/${ch + 1}`}
          aria-label={`${book.name} ${ch + 1}`}
          className="grid h-10 w-10 place-items-center rounded-full border border-brand-navy/15 text-brand-navy hover:bg-brand-sky"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      <AllBooksLink />
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 xl:mt-0">
        <div>
          <Link href={`/word/${book.slug}`} className="text-sm font-semibold text-brand-navy hover:underline">
            {book.name}
          </Link>
          <h1 className="mt-1 font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">
            {book.name} {ch}
          </h1>
          <p className="mt-3 text-lg text-brand-gray">
            {loading && !rows
              ? " "
              : messageCount
              ? `Opened in ${messageCount} ${messageCount === 1 ? "message" : "messages"}`
              : "Not opened in the messages indexed so far"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TranslationToggle value={translation} onChange={setTranslation} />
          {pager}
        </div>
      </header>

      {loading && !rows && (
        <div aria-hidden="true" className="mt-10 space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-brand-sky motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {groups && groups.length === 0 && (
        <div className="mt-10 rounded-[1.5rem] bg-brand-light p-6">
          <p className="text-base text-brand-ink/90">
            Rev. Peter hasn&rsquo;t opened {book.name} {ch} in a message yet.
          </p>
          <Link href={`/word/${book.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:underline">
            See the chapters of {book.name} he preaches from <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      {groups?.length > 0 && (
        <div className="mt-8">
          {groups.map((g) => (
            <Passage key={`${g.vs}|${g.ve}`} book={book} group={g} text={text} onWatch={setWatching} />
          ))}
          <div className="flex justify-end border-t border-brand-navy/10 pt-6">{pager}</div>
        </div>
      )}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </div>
  );
}
