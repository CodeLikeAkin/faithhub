"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Mic } from "lucide-react";
import {
  fetchTodaysDeclaration,
  recordSpeakDay,
  streakLabel,
  toggleSaved,
  useSavedDeclarations,
  useStreak,
} from "@/lib/declarations";
import { cleanTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";
import { DotGrid, Eyebrow, QuoteGlyph, Rings } from "@/components/Decor";

const WORD_MS = 300; // roughly the pace of a declaration spoken aloud

/**
 * Today's declaration, to be spoken. "Speak it" lights the words up one at a
 * time at a speaking pace and counts the day toward the speaking streak, the
 * same streak Speak mode keeps.
 */
export default function TodayCard({ className, style }) {
  const [decl, setDecl] = useState(undefined);
  const [lit, setLit] = useState(-1); // index of the last word lit; -1 = idle
  const [speaking, setSpeaking] = useState(false);
  const timer = useRef(null);
  const saved = useSavedDeclarations();
  const streak = useStreak();

  useEffect(() => {
    let live = true;
    fetchTodaysDeclaration()
      .then((d) => live && setDecl(d))
      .catch(() => live && setDecl(null));
    return () => {
      live = false;
      clearTimeout(timer.current);
    };
  }, []);

  if (decl === null) return null;
  const words = decl ? decl.declaration_text.trim().split(/\s+/) : [];
  const isSaved = !!decl && saved.some((d) => d.id === decl.id);

  const speak = () => {
    clearTimeout(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      recordSpeakDay();
      return;
    }
    setSpeaking(true);
    let i = 0;
    const step = () => {
      setLit(i);
      i += 1;
      if (i < words.length) timer.current = setTimeout(step, WORD_MS);
      else
        timer.current = setTimeout(() => {
          setSpeaking(false);
          setLit(-1);
          recordSpeakDay();
        }, 700);
    };
    step();
  };

  return (
    <article
      style={style}
      className={cn(
        "relative flex min-h-[16rem] flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-brand-deep p-6 text-white shadow-card sm:p-8",
        className
      )}
    >
      {/* The Vision page's dark panel: two glows, a fading dot grid, rings. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-[24rem] w-[24rem] rounded-full bg-brand-navy blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-[20rem] w-[20rem] rounded-full bg-brand-mist/[0.12] blur-3xl" />
        <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_55%)]" />
        <Rings className="absolute -right-28 top-1/2 h-[28rem] w-[28rem] -translate-y-1/2 text-white/[0.08]" />
        <QuoteGlyph className="absolute -right-3 top-6 h-20 w-28 text-white/[0.035] sm:h-24 sm:w-32" />
      </div>
      <Eyebrow tone="dark" className="relative">Today&rsquo;s declaration</Eyebrow>
      {decl === undefined ? (
        <div aria-hidden="true" className="relative mt-auto space-y-3">
          <div className="h-6 w-4/5 rounded-full fh-skeleton-dark" />
          <div className="h-6 w-3/5 rounded-full fh-skeleton-dark" />
        </div>
      ) : (
        <>
          <blockquote className="relative mt-auto max-w-[24ch] font-display text-2xl font-medium leading-snug tracking-tight text-balance sm:text-3xl">
            &ldquo;
            {words.map((w, i) => (
              <span
                key={i}
                className={cn("transition-opacity duration-300", speaking && i > lit ? "opacity-30" : "opacity-100")}
              >
                {w}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
            &rdquo;
          </blockquote>
          {decl.sermon_title && (
            <p className="relative text-sm text-white/65">
              From <span className="font-medium text-white">{cleanTitle(decl.sermon_title)}</span>
            </p>
          )}
          <div className="relative flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={speak}
              disabled={speaking}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-navy transition hover:bg-brand-sky active:scale-[0.97] disabled:opacity-90"
            >
              <Mic size={16} aria-hidden="true" />
              {speaking ? "Speaking" : streak.spokeToday ? "Speak again" : "Speak it"}
            </button>
            <button
              type="button"
              onClick={() => toggleSaved(decl)}
              aria-pressed={isSaved}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/30 px-4 text-sm font-semibold text-white transition hover:border-white active:scale-[0.97]"
            >
              <Bookmark size={16} aria-hidden="true" className={isSaved ? "fill-current" : ""} />
              {isSaved ? "Saved" : "Save"}
            </button>
            <span className="text-sm text-white/65" aria-live="polite">
              {streakLabel(streak)}
            </span>
          </div>
        </>
      )}
    </article>
  );
}
