"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bookmark, ChevronLeft, ChevronRight, Copy, Loader2, Pause, Play, Plus, X } from "lucide-react";
import VideoModal from "@/components/VideoModal";
import { cleanTitle } from "@/lib/titles";
import { parseYoutubeUrl } from "@/lib/youtube";
import { recordSpeakDay, toggleSaved, useSavedDeclarations } from "@/lib/declarations";
import { cn } from "@/lib/utils";

/**
 * Speak mode — the headline of Declarations: one declaration at a time, full
 * screen, large enough to read aloud across a room. Arrows / swipe-free
 * buttons move through the set; Play advances on its own at a reading pace
 * (longer lines get longer), with a speed switch. Opening it counts today
 * toward the speaking streak.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Scale the words to their length — a short line can fill the screen, a long
// one must shrink so nothing is cut off (the stage also scrolls as a last
// resort). Named type steps only.
const sizeFor = (len) =>
  len > 190
    ? "text-2xl sm:text-3xl lg:text-4xl"
    : len > 130
    ? "text-3xl sm:text-4xl lg:text-5xl"
    : len > 80
    ? "text-3xl sm:text-5xl lg:text-6xl"
    : len > 45
    ? "text-4xl sm:text-6xl"
    : "text-5xl sm:text-7xl";

export default function SpeakMode({ title, items, startAt = 0, onClose, onCopy, canLoadMore, loadingMore, onLoadMore }) {
  const [i, setI] = useState(Math.min(startAt, Math.max(0, items.length - 1)));
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [watching, setWatching] = useState(null);
  const closeRef = useRef(null);
  const saved = useSavedDeclarations();
  const speed = SPEEDS[speedIdx];
  const count = items.length;
  const move = (n) => setI((p) => (p + n + count) % count);

  // Speaking counts toward today's streak.
  useEffect(() => {
    recordSpeakDay();
    closeRef.current?.focus();
  }, []);

  // The set can shrink underneath (unsaving from My declarations): stay on a
  // real line, and leave when there's nothing left to speak.
  useEffect(() => {
    if (count === 0) onClose();
    else if (i >= count) setI(count - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // The page behind must not scroll on touch while this covers it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (watching) return; // the video modal owns the keys while it's open
      if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      // Space is play/pause — unless a control has keyboard focus, where
      // Space must press that control.
      else if (e.key === " " && !e.target.closest?.("button, a, input, textarea, select")) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, watching, onClose]);

  // Auto-advance at a reading-aloud pace; restarts on any manual move or
  // speed change so a skip never gets cut short by a stale timer.
  useEffect(() => {
    if (!playing || !items[i]) return;
    const secs = Math.min(16, Math.max(7, items[i].declaration_text.length / 14)) / speed;
    const t = setTimeout(() => move(1), secs * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, i, items, speed]);

  const d = items[i];
  if (!d) return null;
  const parsed = parseYoutubeUrl(d.youtube_url_with_timestamp);
  const isSaved = saved.some((s) => s.id === d.id);

  const pill =
    "inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/15";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Speak mode: ${title}`}
      className="fixed inset-0 z-[60] flex flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-white animate-in fade-in duration-300 sm:px-8"
    >
      <Image src="/declaration-bg-wide.webp" alt="" fill sizes="100vw" className="-z-10 bg-black object-cover" priority />
      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/85">{title}</p>
          <p className="text-xs tabular-nums text-white/75">
            {i + 1} of {count}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSpeedIdx((p) => (p + 1) % SPEEDS.length)}
          aria-label={`Auto-play speed ${speed}×, tap to change`}
          title="Auto-play speed"
          className="grid h-11 min-w-[3.25rem] place-items-center rounded-full border border-white/25 bg-black/50 px-3 text-sm font-bold tabular-nums hover:bg-black/70"
        >
          {speed}×
        </button>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close speak mode"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/50 hover:bg-black/70"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      {/* Stage: centred when it fits, scrolls from the top when it doesn't. */}
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto py-6 text-center custom-scrollbar">
        <div key={d.id || i} aria-live="polite" className="m-auto w-full max-w-4xl animate-in fade-in slide-in-from-right-6 duration-500">
          <blockquote
            className={cn(
              "mx-auto max-w-[22ch] font-display font-medium leading-[1.15] tracking-tight text-balance",
              sizeFor(d.declaration_text.length)
            )}
          >
            &ldquo;{d.declaration_text}&rdquo;
          </blockquote>
          {d.sermon_title && (
            <p className="mt-7 text-sm text-white/60">
              From <span className="font-semibold text-white/85">{cleanTitle(d.sermon_title)}</span>
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {parsed && (
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setWatching({ ...parsed, sermon_title: d.sermon_title });
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
              >
                <Play size={12} fill="currentColor" aria-hidden="true" />
                Watch the moment
              </button>
            )}
            <button type="button" onClick={() => onCopy(d.declaration_text)} className={pill}>
              <Copy size={14} aria-hidden="true" />
              Copy
            </button>
            <button type="button" onClick={() => toggleSaved(d)} aria-pressed={isSaved} className={pill}>
              <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-center gap-5">
        {count <= 14 ? (
          <div className="flex items-center gap-2" aria-hidden="true">
            {items.map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  "h-[7px] rounded-full transition-[width,background-color]",
                  idx === i ? "w-6 bg-white" : "w-[7px] bg-white/30"
                )}
              />
            ))}
          </div>
        ) : (
          <div className="h-[5px] w-52 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${((i + 1) / count) * 100}%` }} />
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous declaration"
            className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/50 hover:bg-black/70"
          >
            <ChevronLeft size={21} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause auto-play" : "Auto-play: move through them on their own"}
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-brand-navy shadow-lg shadow-black/30 transition-transform hover:scale-105"
          >
            {playing ? (
              <Pause size={24} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={24} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next declaration"
            className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/50 hover:bg-black/70"
          >
            <ChevronRight size={21} aria-hidden="true" />
          </button>
          {canLoadMore && (
            <button type="button" onClick={onLoadMore} disabled={loadingMore} className={cn(pill, "h-12 disabled:opacity-60")}>
              {loadingMore ? (
                <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Plus size={15} aria-hidden="true" />
              )}
              More
            </button>
          )}
        </div>
      </div>

      {/* Inside this overlay's stacking context, so it opens above it. */}
      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </div>
  );
}
