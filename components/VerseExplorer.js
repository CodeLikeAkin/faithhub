"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchPassage } from "@/lib/bible";

/**
 * Verse Explorer — every scripture a sermon opened, click-to-reveal.
 * No timestamps, no per-verse YouTube links (by design). Verse text is
 * fetched lazily from bible.helloao.org when a reference is expanded.
 *
 * Renders nothing if the sermon has no extracted scriptures yet, so it's
 * safe to drop onto every sermon page before the pipeline has run.
 */
export default function VerseExplorer({ sermonId }) {
  const [scriptures, setScriptures] = useState([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null); // scripture id
  const [verseText, setVerseText] = useState({}); // id -> { loading, verses } | { error }

  useEffect(() => {
    if (!sermonId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sermon_scriptures")
        .select("*")
        .eq("sermon_id", sermonId)
        .order("order_index", { ascending: true });
      if (!error && data && !cancelled) setScriptures(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [sermonId]);

  if (!scriptures.length) return null;

  const toggleVerse = async (s) => {
    if (expanded === s.id) {
      setExpanded(null);
      return;
    }
    setExpanded(s.id);
    if (verseText[s.id]) return;

    setVerseText((v) => ({ ...v, [s.id]: { loading: true } }));
    const passage = await fetchPassage({
      book: s.book,
      bookId: s.book_id,
      chapter: s.chapter,
      verseStart: s.verse_start,
      verseEnd: s.verse_end,
    });
    setVerseText((v) => ({
      ...v,
      [s.id]: passage ? { verses: passage.verses, translation: passage.translation } : { error: true },
    }));
  };

  return (
    <div className="rounded-3xl border border-brand-navy/10 bg-white overflow-hidden">
      {/* Header — reveal toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4.5 h-4.5" size={18} />
          </span>
          <span>
            <span className="block text-sm font-bold text-brand-ink">
              Scriptures in this message
            </span>
            <span className="block text-xs text-brand-gray">
              {open ? "Tap a verse to read it" : `${scriptures.length} scriptures Pastor opened`}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-brand-navy bg-brand-sky border border-brand-navy/15 rounded-full px-2.5 py-1">
            {scriptures.length}
          </span>
          {open ? (
            <ChevronUp className="w-5 h-5 text-brand-gray" />
          ) : (
            <ChevronDown className="w-5 h-5 text-brand-gray" />
          )}
        </span>
      </button>

      {/* Revealed list */}
      {open && (
        <div className="px-3 sm:px-4 pb-4 pt-1 space-y-2">
          {scriptures.map((s) => {
            const isOpen = expanded === s.id;
            const vt = verseText[s.id];
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-brand-navy/8 bg-[#FAFCFE] overflow-hidden"
              >
                <button
                  onClick={() => toggleVerse(s)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-sky/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span>
                    <span className="block text-[15px] font-bold text-brand-navy">
                      {s.reference}
                    </span>
                    {s.theme && (
                      <span className="block text-xs text-brand-gray mt-0.5">
                        {s.theme}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-brand-gray flex-shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1">
                    {vt?.loading && (
                      <span className="flex items-center gap-2 text-sm text-brand-gray">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading verse…
                      </span>
                    )}
                    {vt?.error && (
                      <p className="text-sm text-brand-gray italic">
                        Couldn&apos;t load this verse right now.
                      </p>
                    )}
                    {vt?.verses && (
                      <div className="space-y-1.5">
                        <p className="text-[15px] leading-relaxed text-brand-ink">
                          {vt.verses.map((v) => (
                            <span key={v.number}>
                              <sup className="text-brand-navy/50 font-bold mr-1">
                                {v.number}
                              </sup>
                              {v.text}{" "}
                            </span>
                          ))}
                        </p>
                        <p className="text-[11px] uppercase tracking-wider text-brand-gray">
                          {s.reference} · {vt.translation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
