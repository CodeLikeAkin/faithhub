"use client";

import { useState } from "react";
import { parseScriptureRef } from "@/lib/ask-format";
import { cn } from "@/lib/utils";
import VerseCard, { TranslationToggle } from "@/components/VerseCard";

export const verseAnchor = (blockId, ref) =>
  `v-${blockId}-${ref.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/**
 * The scriptures named in an answer, each with its verse text — a sticky
 * margin column beside the answer on wide screens, a stacked list after it
 * everywhere else. One KJV/NLT switch for the whole column.
 */
export default function ScriptureMargin({ blockId, refs, focused, sticky = false, className }) {
  const [translation, setTranslation] = useState("KJV");
  if (!refs.length) return null;

  // Sticky beside the answer from xl. A pinned column taller than the
  // viewport would hide its own tail, so it's capped and scrolls on its own.
  return (
    <aside
      aria-label="Scriptures in this answer"
      className={cn(
        sticky && "xl:sticky xl:top-6 xl:flex xl:max-h-[calc(100dvh-13rem)] xl:flex-col xl:self-start",
        className
      )}
    >
      <div className="flex flex-shrink-0 items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-brand-ink">
          {refs.length === 1 ? "Scripture" : `${refs.length} scriptures`}
        </h3>
        <TranslationToggle value={translation} onChange={setTranslation} />
      </div>
      <ul className={cn("mt-3 space-y-2.5", sticky && "xl:-mr-2 xl:min-h-0 xl:overflow-y-auto xl:pr-2 custom-scrollbar")}>
        {refs.map((ref) => (
          <li key={ref}>
            <VerseCard
              id={verseAnchor(blockId, ref)}
              reference={ref}
              passage={parseScriptureRef(ref)}
              translation={translation}
              highlighted={focused === ref}
              meta={parseScriptureRef(ref)?.wholeChapter ? "Opening verses" : null}
              className="scroll-mt-6"
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}
