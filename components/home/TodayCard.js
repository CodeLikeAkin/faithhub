"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { fetchTodaysDeclaration, toggleSaved, useSavedDeclarations } from "@/lib/declarations";
import { cleanTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";
import { DotGrid, Eyebrow, QuoteGlyph, Rings } from "@/components/Decor";

/**
 * Today's declaration, to read and keep. Speaking it — the word-by-word pace
 * and the streak it counts toward — belongs to Speak mode; this card only
 * shows the declaration and lets you save it.
 */
export default function TodayCard({ className, style }) {
  const [decl, setDecl] = useState(undefined);
  const saved = useSavedDeclarations();

  useEffect(() => {
    let live = true;
    fetchTodaysDeclaration()
      .then((d) => live && setDecl(d))
      .catch(() => live && setDecl(null));
    return () => {
      live = false;
    };
  }, []);

  if (decl === null) return null;
  const isSaved = !!decl && saved.some((d) => d.id === decl.id);

  return (
    <article
      style={style}
      className={cn(
        "relative flex min-h-[16rem] flex-col items-center gap-4 overflow-hidden rounded-[1.75rem] bg-brand-deep p-6 text-center text-white shadow-card sm:p-8",
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
      <Eyebrow tone="dark" className="relative self-start text-left">Today&rsquo;s declaration</Eyebrow>
      {decl === undefined ? (
        <div aria-hidden="true" className="relative my-auto space-y-3">
          <div className="h-6 w-4/5 rounded-full fh-skeleton-dark" />
          <div className="h-6 w-3/5 rounded-full fh-skeleton-dark" />
        </div>
      ) : (
        <div className="relative my-auto w-full">
          {/* my-auto above, not mt-auto: the card stretches to its grid row,
              and the slack has to split above and below the declaration or it
              all piles up under the eyebrow. Centered, so the quote mark sits
              inside the measure rather than hanging: no text-indent here. */}
          <blockquote className="mx-auto max-w-[30ch] font-display text-xl font-medium leading-snug tracking-tight text-balance sm:text-2xl">
            &ldquo;{decl.declaration_text.trim()}&rdquo;
          </blockquote>
          {decl.sermon_title && (
            <p className="mt-2 text-sm text-white/65">
              From <span className="font-medium text-white">{cleanTitle(decl.sermon_title)}</span>
            </p>
          )}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => toggleSaved(decl)}
              aria-pressed={isSaved}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/40 px-4 text-sm font-semibold text-white transition hover:border-white active:scale-[0.97]"
            >
              <Bookmark size={16} aria-hidden="true" className={isSaved ? "fill-current" : ""} />
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
