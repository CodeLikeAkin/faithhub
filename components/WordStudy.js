"use client";

import { useEffect, useState } from "react";
import { Languages, ChevronDown, ChevronUp, Info, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";

const LANGUAGE_LABEL = {
  greek: "Greek",
  hebrew: "Hebrew",
  aramaic: "Aramaic",
};

/**
 * Word Study — every Greek/Hebrew/Aramaic word Rev. Alabi explicitly
 * explains in a sermon, click-to-reveal, same pattern as VerseExplorer.
 *
 * Renders nothing if the sermon has no extracted word studies yet, so it's
 * safe to drop onto every sermon page before the pipeline has run.
 */
export default function WordStudy({ sermonId }) {
  const [words, setWords] = useState([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null); // word study id

  useEffect(() => {
    if (!sermonId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sermon_word_studies")
        .select("*")
        .eq("sermon_id", sermonId)
        .order("order_index", { ascending: true });
      if (!error && data && !cancelled) setWords(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [sermonId]);

  if (!words.length) return null;

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
            <Languages className="w-4.5 h-4.5" size={18} />
          </span>
          <span>
            <span className="block text-sm font-bold text-brand-ink">
              Word Study
            </span>
            <span className="block text-xs text-brand-gray">
              {open ? "Tap a word to see the explanation" : `${words.length} original-language word${words.length === 1 ? "" : "s"} explained`}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-brand-navy bg-brand-sky border border-brand-navy/15 rounded-full px-2.5 py-1">
            {words.length}
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
          {words.map((w) => {
            const isOpen = expanded === w.id;
            return (
              <div
                key={w.id}
                className="rounded-2xl border border-brand-navy/8 bg-[#FAFCFE] overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : w.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-sky/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[15px] font-bold text-brand-navy truncate">
                      {w.word}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-navy/60 bg-brand-navy/5 rounded-full px-2 py-0.5 flex-shrink-0">
                      {LANGUAGE_LABEL[w.language] || w.language}
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-brand-gray flex-shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-2.5">
                    {w.original_script && (
                      <p className="text-2xl font-bold text-brand-navy">
                        {w.original_script}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {w.pronunciation && (
                        <span className="text-xs text-brand-gray italic">
                          {w.pronunciation}
                        </span>
                      )}
                      {w.strongs_number && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-navy/60 bg-brand-navy/5 rounded-full px-2 py-0.5">
                          Strong's {w.strongs_number}
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] leading-relaxed text-brand-ink">
                      {w.meaning}
                    </p>
                    {w.reference && (
                      <p className="text-[11px] uppercase tracking-wider text-brand-gray">
                        {w.reference}
                      </p>
                    )}
                    {w.note && (
                      <div className="flex items-start gap-2 rounded-xl bg-brand-sky/40 border border-brand-navy/10 px-3 py-2.5">
                        <Info className="w-3.5 h-3.5 text-brand-navy/60 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-brand-gray leading-relaxed">
                          {w.note}
                        </p>
                      </div>
                    )}
                    {w.youtube_url_with_timestamp && (
                      <a
                        href={w.youtube_url_with_timestamp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy bg-brand-sky border border-brand-navy/15 rounded-full px-3 py-1.5 hover:bg-brand-sky/70 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Watch moment
                      </a>
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
