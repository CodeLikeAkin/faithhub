"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { fmtTime } from "@/lib/ask-format";
import { cleanTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";

/**
 * The cited sermon moments behind an answer — the most trustworthy part of
 * it — as a swipeable row of video thumbnails with timestamps. Shown at every
 * screen size, directly under the question.
 */

const BLEED = {
  page: "-mx-4 px-4 scroll-px-4 sm:-mx-8 sm:px-8 sm:scroll-px-8",
  panel: "-mx-5 px-5 scroll-px-5",
};

function MomentCard({ n, seg, onCite, highlighted, describe, density }) {
  const title = describe?.(seg) || cleanTitle(seg.sermon_title);
  const playable = !!seg.video_id;
  const Tag = playable ? "button" : "div";

  return (
    <Tag
      {...(playable
        ? {
            type: "button",
            onClick: () => onCite?.(seg),
            "aria-label": `Play moment ${n}: ${title}, at ${fmtTime(seg.start_seconds)}`,
          }
        : {})}
      className="group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
    >
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
      <span className="mt-2.5 block truncate text-sm font-semibold text-brand-ink">{title}</span>
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
    </Tag>
  );
}

export function MomentsSkeleton({ density = "page" }) {
  return (
    <div aria-hidden="true" className={cn("mt-7 flex gap-3 overflow-hidden", BLEED[density])}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn("flex-shrink-0", density === "panel" ? "w-44" : "w-56 sm:w-60")}>
          <div className="aspect-video rounded-2xl bg-brand-sky motion-safe:animate-pulse" />
          <div className="mt-2.5 h-3 w-3/4 rounded-full bg-brand-sky motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-brand-sky/70 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function MomentsRow({ segmentMap, onCite, highlighted, describe, density = "page", className }) {
  const entries = Object.entries(segmentMap || {});
  const rowRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

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
    if (highlighted == null || !row) return;
    const card = row.querySelector(`[data-n="${highlighted}"]`);
    if (!card) return;
    const left = card.offsetLeft; // the row is `relative`, so this is row-local
    if (left < row.scrollLeft || left + card.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [highlighted]);

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
        {page && (edges.left || edges.right) && (
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
    </section>
  );
}
