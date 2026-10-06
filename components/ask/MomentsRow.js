"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, List, Play } from "lucide-react";
import { fmtTime } from "@/lib/ask-format";
import { cleanTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";

/**
 * The cited sermon moments behind an answer — the most trustworthy part of
 * it — as a swipeable row of video thumbnails with timestamps. Shown at every
 * screen size, after the answer and its related questions.
 */

const VIEW_KEY = "hof-ask-moments-view"; // "cards" | "list", remembered per browser

const BLEED = {
  page: "-mx-4 px-4 scroll-px-4 sm:-mx-8 sm:px-8 sm:scroll-px-8",
  panel: "-mx-5 px-5 scroll-px-5",
};

function MomentCard({ n, seg, onCite, highlighted, describe, density }) {
  const title = describe?.(seg) || cleanTitle(seg.sermon_title);
  const playable = !!seg.video_id;
  // Two affordances, not one: the thumbnail plays the cited moment, the title
  // opens the message itself (its notes, scriptures, words and declarations).
  const href = seg.sermon_id ? `/sermon/${seg.sermon_id}#notes` : null;

  const thumb = (
    <span
      className={cn(
        "relative block aspect-video overflow-hidden rounded-2xl bg-brand-sky ring-1 transition-[box-shadow] duration-300",
        highlighted ? "shadow-lg shadow-brand-navy/25 ring-2 ring-brand-navy" : "ring-brand-navy/10"
      )}
    >
      {playable && (
        <img
          src={`https://img.youtube.com/vi/${seg.video_id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
      <span className="absolute left-2 top-2 grid h-6 min-w-[1.5rem] place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-brand-navy shadow">
        {n}
      </span>
      {playable && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white">
          <Play size={10} fill="currentColor" aria-hidden="true" />
          {fmtTime(seg.start_seconds)}
        </span>
      )}
      {playable && (
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/95 text-brand-navy shadow-lg">
            <Play size={17} fill="currentColor" className="translate-x-px" aria-hidden="true" />
          </span>
        </span>
      )}
    </span>
  );

  return (
    <div className="group block w-full rounded-2xl text-left">
      {playable ? (
        <button
          type="button"
          onClick={() => onCite?.(seg)}
          aria-label={`Play moment ${n}: ${title}, at ${fmtTime(seg.start_seconds)}`}
          className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          {thumb}
        </button>
      ) : (
        thumb
      )}
      {href ? (
        <Link
          href={href}
          className="mt-2.5 block truncate rounded text-sm font-semibold text-brand-ink underline-offset-2 hover:text-brand-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          {title}
        </Link>
      ) : (
        <span className="mt-2.5 block truncate text-sm font-semibold text-brand-ink">{title}</span>
      )}
      {seg.speaker && (
        <span className="mt-0.5 block truncate text-xs font-medium text-brand-gray">{seg.speaker}</span>
      )}
      {seg.text && (
        <span
          className={cn(
            "mt-1 block font-display italic leading-snug text-brand-gray",
            density === "panel" ? "line-clamp-2 text-sm" : "line-clamp-3 text-sm"
          )}
        >
          &ldquo;{seg.text}&rdquo;
        </span>
      )}
    </div>
  );
}

/** Cards | List — thumbnails you swipe through, or every moment on one line. */
function ViewToggle({ value, onChange }) {
  return (
    <span
      role="radiogroup"
      aria-label="How to show the cited moments"
      className="inline-flex flex-shrink-0 rounded-full border border-brand-navy/15 bg-white p-0.5"
    >
      {[
        ["cards", LayoutGrid, "Cards", "Thumbnails you swipe through"],
        ["list", List, "List", "Every moment on one line"],
      ].map(([mode, Icon, label, hint]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          aria-label={label}
          title={hint}
          onClick={() => onChange(mode)}
          className={cn(
            "relative grid h-7 w-7 place-items-center rounded-full transition-colors before:absolute before:-inset-2 before:content-['']",
            value === mode ? "bg-brand-navy text-white" : "text-brand-gray hover:text-brand-navy"
          )}
        >
          <Icon size={14} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

/**
 * List view: one line per cited moment. No thumbnail to wait for and no
 * sideways scrolling, so all of an answer's moments are visible at once
 * instead of the two a phone fits in the card row. Same two affordances as
 * the card — play the moment, or open the message.
 */
function MomentRow({ n, seg, onCite, describe, highlighted }) {
  const title = describe?.(seg) || cleanTitle(seg.sermon_title);
  const playable = !!seg.video_id;
  const href = seg.sermon_id ? `/sermon/${seg.sermon_id}#notes` : null;

  return (
    <li
      data-n={n}
      className={cn(
        "flex items-center gap-3 border-b border-brand-navy/10 py-2.5 transition-[box-shadow] first:border-t",
        // A ring, not a fill: tinting the row put brand-gray on brand-sky at
        // 4.32:1, under AA. This also matches how the card marks itself.
        highlighted && "rounded-lg ring-2 ring-inset ring-brand-navy"
      )}
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-brand-sky text-xs font-bold text-brand-navy"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            // Two lines, not one: these titles differ only in their trailing
            // "- Part 4", which is exactly what a single truncated line eats.
            className="block text-sm font-semibold leading-snug text-brand-ink underline-offset-2 line-clamp-2 hover:text-brand-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          >
            {title}
          </Link>
        ) : (
          <span className="block text-sm font-semibold leading-snug text-brand-ink line-clamp-2">{title}</span>
        )}
        {(seg.speaker || playable) && (
          <span className="mt-0.5 block truncate text-xs text-brand-gray">
            {seg.speaker}
            {seg.speaker && playable && " · "}
            {playable && fmtTime(seg.start_seconds)}
          </span>
        )}
      </div>
      {playable && (
        <button
          type="button"
          onClick={() => onCite?.(seg)}
          aria-label={`Play moment ${n}: ${title}, at ${fmtTime(seg.start_seconds)}`}
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand-navy text-white transition-[background-color,transform] hover:bg-brand-deep active:scale-95"
        >
          <Play size={12} fill="currentColor" aria-hidden="true" className="ml-px" />
        </button>
      )}
      {href && (
        <Link
          href={href}
          aria-label={`Open the message: ${title}`}
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-brand-navy/70 transition-colors hover:bg-brand-sky hover:text-brand-navy"
        >
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

export default function MomentsRow({ segmentMap, onCite, highlighted, describe, density = "page", className }) {
  const entries = Object.entries(segmentMap || {});
  const rowRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  // Cards stay the default: the thumbnails are the trust signal. List is for
  // when you want to see every moment behind an answer at once.
  const [view, setView] = useState("cards");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "cards" || saved === "list") setView(saved);
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

  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, entries.length]);

  // Hovering a citation pill brings its card into the row's view (horizontal
  // only — never moves the reader's vertical position).
  useEffect(() => {
    const row = rowRef.current;
    // List view has nothing to scroll sideways, and scrolling it vertically
    // would move the reader's place in the answer. The row ring is enough.
    if (view !== "cards" || highlighted == null || !row) return;
    const card = row.querySelector(`[data-n="${highlighted}"]`);
    if (!card) return;
    const left = card.offsetLeft; // the row is `relative`, so this is row-local
    if (left < row.scrollLeft || left + card.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [highlighted, view]);

  if (!entries.length) return null;

  const messages = new Set(entries.map(([, s]) => s.sermon_title || s.video_id)).size;
  const page = density === "page";
  const nudge = (dir) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section aria-label="Cited moments" className={className ?? (page ? "mt-7" : "mt-5")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-gray">
          <span className="font-semibold text-brand-ink">
            {entries.length} {entries.length === 1 ? "moment" : "moments"}
          </span>{" "}
          from {messages} {messages === 1 ? "message" : "messages"}
        </p>
        <div className="flex flex-shrink-0 items-center gap-2">
          {entries.length > 1 && <ViewToggle value={view} onChange={changeView} />}
          {page && view === "cards" && (edges.left || edges.right) && (
            <div className="hidden gap-1.5 sm:flex">
              {[
                [-1, ChevronLeft, "Earlier moments", edges.left],
                [1, ChevronRight, "More moments", edges.right],
              ].map(([dir, Icon, label, enabled]) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => nudge(dir)}
                  disabled={!enabled}
                  aria-label={label}
                  className="grid h-8 w-8 place-items-center rounded-full border border-brand-navy/15 text-brand-navy transition-colors hover:bg-brand-sky disabled:opacity-30"
                >
                  <Icon size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "list" ? (
        <ol className="mt-3">
          {entries.map(([n, seg]) => (
            <MomentRow
              key={n}
              n={n}
              seg={seg}
              onCite={onCite}
              describe={describe}
              highlighted={String(highlighted) === String(n)}
            />
          ))}
        </ol>
      ) : (
        <ul
          ref={rowRef}
          onScroll={measure}
          className={cn(
            "relative mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            BLEED[density]
          )}
        >
          {entries.map(([n, seg]) => (
            <li
              key={n}
              data-n={n}
              className={cn("flex-shrink-0 snap-start", page ? "w-56 sm:w-60" : "w-44")}
            >
              <MomentCard
                n={n}
                seg={seg}
                onCite={onCite}
                describe={describe}
                density={density}
                highlighted={String(highlighted) === String(n)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
