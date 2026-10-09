"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { parseScriptureRef } from "@/lib/ask-format";
import VerseCard, { TranslationToggle } from "@/components/VerseCard";

/**
 * A scripture opened in place. Tapping a verse in an answer used to scroll to
 * its card in the "Scriptures in this answer" list — which sits after the
 * whole answer unless the screen is wide enough for the side column, so the
 * reader was thrown to the bottom of the page. This opens the verse over the
 * reading instead: a bottom sheet on phones, a centred card on larger screens.
 * Close it (X, backdrop, Esc) and the reader is exactly where they were.
 */
export default function VerseSheet({ reference, onClose }) {
  const [translation, setTranslation] = useState("KJV");
  const closeRef = useRef(null);

  // Focus moves into the dialog and comes back to the tapped verse on close.
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const passage = parseScriptureRef(reference);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={reference}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-[1.75rem] bg-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:fade-in motion-safe:duration-200 sm:rounded-[1.75rem]"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-4">
          <TranslationToggle value={translation} onChange={setTranslation} />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full text-brand-gray transition-colors hover:bg-brand-sky hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 custom-scrollbar">
          <VerseCard
            reference={reference}
            passage={passage}
            translation={translation}
            maxVerses={12}
            meta={passage?.wholeChapter ? "Opening verses" : null}
          />
        </div>
      </div>
    </div>
  );
}
