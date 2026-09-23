"use client";

import { Bookmark, Copy, Play } from "lucide-react";
import { fmtTime } from "@/lib/ask-format";
import { cleanTitle } from "@/lib/titles";
import { parseYoutubeUrl } from "@/lib/youtube";
import { toggleSaved, useSavedDeclarations } from "@/lib/declarations";
import { cn } from "@/lib/utils";

/**
 * One declaration in a list: the words to speak (Newsreader, reading-aloud
 * size), then watch the moment it was said, copy, and save to My
 * declarations. `onSaveChange(saved, declaration)` lets a page react (the
 * My declarations page offers Undo). `sourceLabel` replaces the sermon title
 * as the source line (a series page names the part instead).
 */
export default function DeclarationLine({
  declaration,
  index,
  onWatch,
  onCopy,
  onSaveChange,
  showSource = true,
  sourceLabel,
}) {
  const saved = useSavedDeclarations();
  const isSaved = saved.some((d) => d.id === declaration.id);
  const parsed = parseYoutubeUrl(declaration.youtube_url_with_timestamp);

  return (
    <li className="flex gap-3 py-5 sm:gap-5">
      {index != null && (
        <span aria-hidden="true" className="w-7 flex-shrink-0 pt-1 text-right font-display text-lg tabular-nums text-brand-navy/35">
          {index + 1}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl leading-snug text-brand-ink text-pretty sm:text-2xl">
          {declaration.declaration_text}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {parsed && (
            <button
              type="button"
              onClick={() => onWatch({ ...parsed, sermon_title: declaration.sermon_title })}
              aria-label={`Watch the moment it was said, at ${fmtTime(parsed.start_seconds)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-navy/15 px-3 text-sm font-medium tabular-nums text-brand-navy transition-colors hover:bg-brand-sky"
            >
              <Play size={12} fill="currentColor" aria-hidden="true" />
              {fmtTime(parsed.start_seconds)}
            </button>
          )}
          <button
            type="button"
            onClick={() => onCopy(declaration.declaration_text)}
            aria-label="Copy this declaration"
            title="Copy"
            className="grid h-9 w-9 place-items-center rounded-full text-brand-gray transition-colors hover:bg-brand-sky hover:text-brand-navy"
          >
            <Copy size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = toggleSaved(declaration);
              onSaveChange?.(now, declaration);
            }}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Remove from My declarations" : "Save to My declarations"}
            title={isSaved ? "Saved — tap to remove" : "Save to My declarations"}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-brand-sky",
              isSaved ? "text-brand-navy" : "text-brand-gray hover:text-brand-navy"
            )}
          >
            <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
          </button>
          {showSource && (sourceLabel || declaration.sermon_title) && (
            <span className="ml-1 min-w-0 flex-1 truncate text-xs text-brand-gray">
              {sourceLabel || cleanTitle(declaration.sermon_title)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
