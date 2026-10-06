"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import { fetchTodaysDeclaration, toggleSaved, useSavedDeclarations } from "@/lib/declarations";
import { cleanTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/Decor";

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
        "relative isolate flex min-h-[18rem] flex-col items-center gap-4 overflow-hidden rounded-[1.75rem] bg-black text-center text-white shadow-card px-9 pb-9 pt-12 sm:p-8",
        className
      )}
    >
      {/* Two crops of the same art: the wide strip fits the card from sm up,
          the squarer one keeps the red frame showing on a phone. Only the
          visible one loads (display:none images stay lazy). */}
      <Image
        src="/declaration-bg-card.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 bg-black object-fill sm:hidden"
      />
      <Image
        src="/declaration-bg-wide.webp"
        alt=""
        fill
        sizes="(min-width: 1024px) 66vw, 100vw"
        className="-z-10 hidden bg-black object-fill sm:block"
      />
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
