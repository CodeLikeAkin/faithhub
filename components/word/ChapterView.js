"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Play } from "lucide-react";
import VideoModal from "@/components/VideoModal";
import { TranslationToggle } from "@/components/VerseCard";
import { bookFromSlug, passageLabel } from "@/lib/canon";
import { loadBookRows, loadChapterText, useLoad } from "@/lib/word-data";
import { cleanTitle, parseSermonDate } from "@/lib/titles";
import { fmtTime } from "@/lib/ask-format";
import { scrollToElement } from "@/lib/scroll";
import { cn } from "@/lib/utils";

const MESSAGES_PER_PASSAGE = 5;
const MAX_VERSES = 8; // a long range shows its opening verses
const VIEW_KEY = "hof-word-chapter-view"; // "list" | "read", remembered per browser

const sermonDate = (s) => {
  const d = parseSermonDate(s?.title) || (s?.sermon_date ? new Date(s.sermon_date) : null);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
};

const groupKey = (g) => `${g.vs}|${g.ve}`;
const groupAnchor = (g) => (g.vs ? `v${g.vs}` : "whole");

/** List | Read — whether every passage prints its Bible text up front or stays a one-line row. */
function ViewToggle({ value, onChange, className }) {
  return (
    <span
      role="radiogroup"
      aria-label="How to show this chapter"
      className={cn("inline-flex rounded-full border border-brand-navy/15 bg-white p-0.5", className)}
    >
      {[
        ["list", "List", "Every passage as one line"],
        ["read", "Read", "Every passage with its Bible text"],
      ].map(([mode, label, hint]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          title={hint}
          onClick={() => onChange(mode)}
          className={cn(
            "relative rounded-full px-2.5 py-1 text-xs font-bold transition-colors before:absolute before:-inset-2 before:content-['']",
            value === mode ? "bg-brand-navy text-white" : "text-brand-gray hover:text-brand-navy"
          )}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/** The verse text + the messages that open a passage — the same body in both views. */
function PassageBody({ group, text, onWatch }) {
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
    <>
      {verses.length > 0 && (
        // 16px on a phone, matching VerseCard; larger as the screen grows.
        <blockquote className="mt-3 font-display text-base leading-relaxed text-brand-ink sm:text-lg lg:text-xl">
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
          // A phone gets a compact row — play | text | open — instead of two
          // pill buttons under every message, which doubled each row's height.
          <li key={sermon.id} className="flex items-center gap-3 p-4 sm:justify-between">
            {sermon.youtube_video_id && (
              <button
                type="button"
                onClick={() =>
                  onWatch({ video_id: sermon.youtube_video_id, start_seconds: ts || 0, sermon_title: sermon.title })
                }
                aria-label={ts != null ? `Watch at ${fmtTime(ts)}` : "Watch the message"}
                className="grid h-10 w-10 flex-shrink-0 place-items-center self-start rounded-full bg-brand-navy text-white transition-[background-color,transform] hover:bg-brand-deep active:scale-95 sm:hidden"
              >
                <Play size={14} fill="currentColor" aria-hidden="true" className="ml-0.5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-brand-ink">{cleanTitle(sermon.title)}</p>
              <p className="mt-0.5 text-xs text-brand-gray">
                {sermonDate(sermon)}
                {ts != null && <span className="sm:hidden"> · at {fmtTime(ts)}</span>}
              </p>
              {theme && <p className="mt-1.5 text-sm text-brand-ink/75">Why he read it: {theme}</p>}
            </div>
            <Link
              href={`/sermon/${sermon.id}${ts != null ? `?t=${Math.floor(ts)}` : ""}`}
              aria-label={`Open the lesson: ${cleanTitle(sermon.title)}`}
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-brand-navy/50 transition-colors hover:bg-brand-sky hover:text-brand-navy sm:hidden"
            >
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <div className="hidden flex-shrink-0 gap-2 sm:flex">
              {sermon.youtube_video_id && (
                <button
                  type="button"
                  onClick={() =>
                    onWatch({ video_id: sermon.youtube_video_id, start_seconds: ts || 0, sermon_title: sermon.title })
                  }
                  aria-label={ts != null ? `Watch at ${fmtTime(ts)}` : "Watch the message"}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-navy px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
                >
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                  Watch
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
    </>
  );
}

/** Read view: every passage open, its Bible text printed above the messages. */
function PassageArticle({ book, group, text, onWatch }) {
  return (
    <article id={groupAnchor(group)} className="scroll-mt-6 border-t border-brand-navy/10 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-brand-navy">
          {group.vs
            ? passageLabel(book.name, group.chapter, group.vs, group.ve)
            : `${book.name} ${group.chapter} — the whole chapter`}
        </h2>
        <span className="text-sm tabular-nums text-brand-gray">
          {group.messages.length} {group.messages.length === 1 ? "message" : "messages"}
        </span>
      </header>
      <PassageBody group={group} text={text} onWatch={onWatch} />
    </article>
  );
}

/**
 * List view: one tappable line per passage — every verse of the chapter he
 * opened, visible at a glance. The Bible text and the messages stay folded
 * away until you ask for them.
 */
function PassageRow({ book, group, text, onWatch, open, onToggle }) {
  const count = group.messages.length;
  return (
    <li id={groupAnchor(group)} className="scroll-mt-6 border-b border-brand-navy/10 first:border-t">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-brand-sky/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("flex-shrink-0 text-brand-navy/40 transition-transform duration-200", open && "rotate-180")}
          />
          <span className="min-w-0 flex-1 text-base font-bold text-brand-navy">
            {group.vs ? passageLabel(book.name, group.chapter, group.vs, group.ve) : "The whole chapter"}
          </span>
          <span className="flex-shrink-0 text-sm tabular-nums text-brand-gray">
            {count} {count === 1 ? "message" : "messages"}
          </span>
        </button>
      </h2>
      {open && (
        <div className="pb-6 pl-7">
          <PassageBody group={group} text={text} onWatch={onWatch} />
        </div>
      )}
    </li>
  );
}

/** /word/[book]/[chapter] — every passage of a chapter he opened, with its text and the moments. */
export default function ChapterView({ slug, chapter }) {
  const book = bookFromSlug(slug);
  const ch = parseInt(chapter, 10);
  const valid = book && ch >= 1 && ch <= book.chapters;
  const [translation, setTranslation] = useState("KJV");
  const [watching, setWatching] = useState(null);
  // List first: the chapter's passages are what you came to scan, and a wall of
  // KJV text pushed the later ones off the screen. Remembered per browser.
  const [view, setView] = useState("list");
  const [opened, setOpened] = useState(() => new Set());
  const { data: rows, loading } = useLoad(() => (valid ? loadBookRows(book.id) : []), [book?.id, valid]);
  // Fetched up front in both views, not on first expand: waiting until a row
  // opens made the verse text pop in a beat later and shove the rows below it
  // down. One session-cached request buys an expansion that doesn't jump.
  const { data: text } = useLoad(
    () => (valid ? loadChapterText(book, ch, translation) : null),
    [book?.id, ch, translation, valid]
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "list" || saved === "read") setView(saved);
    } catch {
      /* private mode — the default stands */
    }
  }, []);

  const changeView = useCallback((next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* nothing to remember it with */
    }
  }, []);

  const toggle = useCallback((key) => {
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
        g.bySermon.set(r.sermon.id, {
          sermon: r.sermon,
          ts: r.timestamp_seconds ?? null,
          theme: r.theme || prev?.theme || null,
        });
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

  // Arriving at #v28: bring the passage that holds verse 28 into view — and in
  // list view open it, or there'd be nothing to read when you got there.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !groups?.length) return;
    const m = window.location.hash.match(/^#v(\d+)$/);
    if (!m) return;
    jumped.current = true;
    const verse = Number(m[1]);
    const g = groups.find((x) => x.vs && x.vs <= verse && verse <= x.ve) || groups.find((x) => x.vs === verse);
    if (!g) return;
    setOpened((prev) => new Set(prev).add(groupKey(g)));
    const el = document.getElementById(groupAnchor(g));
    if (el) setTimeout(() => scrollToElement(el, { offset: 16, smooth: false }), 60);
  }, [groups]);

  if (!valid) {
    return (
      <div className="px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">That chapter doesn&rsquo;t exist</h1>
        <Link
          href={book ? `/word/${book.slug}` : "/word"}
          className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-navy hover:underline"
        >
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

  const allOpen = groups?.length > 0 && groups.every((g) => opened.has(groupKey(g)));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* Set as the Vision eyebrow (rule + caps), still the way back to the book. */}
          <Link
            href={`/word/${book.slug}`}
            className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-navy hover:underline"
          >
            <span aria-hidden="true" className="h-px w-8 bg-brand-navy/40" />
            {book.name}
          </Link>
          <h1 className="mt-3 font-display text-4xl font-medium leading-[1.04] tracking-tight text-brand-ink sm:text-5xl">
            {book.name} {ch}
          </h1>
        </div>
        {/* Always these three, always here. Moving a switch between rows when
            the view changes made the whole header reflow under the cursor. */}
        <div className="flex flex-shrink-0 items-center gap-3">
          <ViewToggle value={view} onChange={changeView} />
          <TranslationToggle value={translation} onChange={setTranslation} />
          {pager}
        </div>
      </header>

      {/* One line of context, not three — the passages are what you came for. */}
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="min-w-0 text-sm text-brand-gray">
          {loading && !rows
            ? " "
            : messageCount
            ? `${groups.length} ${groups.length === 1 ? "passage" : "passages"} · opened in ${messageCount} ${
                messageCount === 1 ? "message" : "messages"
              }`
            : "Not opened in the messages indexed so far"}
        </p>
        {view === "list" && groups?.length > 0 && (
          <button
            type="button"
            onClick={() => setOpened(allOpen ? new Set() : new Set(groups.map(groupKey)))}
            className="flex-shrink-0 text-sm font-semibold text-brand-navy hover:underline"
          >
            {allOpen ? "Close all" : "Open all"}
          </button>
        )}
      </div>

      {loading && !rows && (
        <div aria-hidden="true" className="mt-6 space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-brand-sky motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {groups && groups.length === 0 && (
        <div className="mt-6 rounded-[1.5rem] bg-brand-light p-6">
          <p className="text-base text-brand-ink/90">
            Rev. Peter hasn&rsquo;t opened {book.name} {ch} in a message yet.
          </p>
          <Link
            href={`/word/${book.slug}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:underline"
          >
            See the chapters of {book.name} he preaches from <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      {groups?.length > 0 && view === "list" && (
        <div className="mt-5">
          <ul>
            {groups.map((g) => (
              <PassageRow
                key={groupKey(g)}
                book={book}
                group={g}
                text={text}
                onWatch={setWatching}
                open={opened.has(groupKey(g))}
                onToggle={() => toggle(groupKey(g))}
              />
            ))}
          </ul>
          <div className="mt-6 flex justify-end">{pager}</div>
        </div>
      )}

      {groups?.length > 0 && view === "read" && (
        <div className="mt-5">
          {groups.map((g) => (
            <PassageArticle key={groupKey(g)} book={book} group={g} text={text} onWatch={setWatching} />
          ))}
          <div className="flex justify-end border-t border-brand-navy/10 pt-6">{pager}</div>
        </div>
      )}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </div>
  );
}
