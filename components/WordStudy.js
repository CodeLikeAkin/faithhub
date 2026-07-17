"use client";

import { useEffect, useState } from "react";
import { Languages, ChevronDown, ChevronUp, Info, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseYoutubeUrl } from "@/lib/youtube";
import VideoModal from "@/components/VideoModal";

const LANGUAGE_LABEL = {
  greek: "Greek",
  hebrew: "Hebrew",
  aramaic: "Aramaic",
};

/**
 * Word Study — every Greek/Hebrew/Aramaic word Rev. Alabi explicitly
 * explains in a sermon. Words render as chips; tapping one reveals its
 * explanation below the row, same pattern as VerseExplorer.
 *
 * Renders nothing if the sermon has no extracted word studies yet, so it's
 * safe to drop onto every sermon page before the pipeline has run.
 */
export default function WordStudy({ sermonId, words: wordsProp, embedded = false }) {
  const [fetchedWords, setFetchedWords] = useState([]);
  const [open, setOpen] = useState(embedded); // embedded → always expanded (a tab is the toggle)
  const [expandedId, setExpandedId] = useState(null);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal

  // When a parent supplies the rows (e.g. the sermon page, which needs the
  // count for its tab), use them directly; otherwise fetch our own.
  const controlled = wordsProp != null;
  const words = controlled ? wordsProp : fetchedWords;

  useEffect(() => {
    if (controlled || !sermonId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sermon_word_studies")
        .select("*")
        .eq("sermon_id", sermonId)
        .order("order_index", { ascending: true });
      if (!error && data && !cancelled) setFetchedWords(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [sermonId, controlled]);

  if (!words.length) return null;

  const Chip = ({ w }) => (
    <button
      onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
      aria-expanded={expandedId === w.id}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        expandedId === w.id
          ? "bg-brand-navy text-white border-brand-navy"
          : "bg-brand-sky text-brand-navy border-brand-navy/10 hover:border-brand-navy/40"
      }`}
    >
      {w.word}
      <span
        className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${
          expandedId === w.id ? "bg-white/15 text-white/80" : "bg-brand-navy/5 text-brand-navy/50"
        }`}
      >
        {LANGUAGE_LABEL[w.language] || w.language}
      </span>
    </button>
  );

  const Reveal = ({ w }) => (
    <div className="mt-2.5 rounded-r-2xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-white px-4 sm:px-5 py-4 space-y-2.5">
      {w.original_script && (
        <p className="text-2xl font-bold text-brand-navy">{w.original_script}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {w.pronunciation && (
          <span className="text-xs text-brand-gray italic">{w.pronunciation}</span>
        )}
        {w.strongs_number && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-navy/60 bg-brand-navy/5 rounded-full px-2 py-0.5">
            Strong&apos;s {w.strongs_number}
          </span>
        )}
      </div>
      <p className="text-[15px] leading-relaxed text-brand-ink">{w.meaning}</p>
      {w.reference && (
        <p className="text-[11px] uppercase tracking-wider text-brand-gray">{w.reference}</p>
      )}
      {w.note && (
        <div className="flex items-start gap-2 rounded-xl bg-white/70 border border-brand-navy/10 px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-brand-navy/60 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-brand-gray leading-relaxed">{w.note}</p>
        </div>
      )}
      {(() => {
        const parsed = parseYoutubeUrl(w.youtube_url_with_timestamp);
        if (!parsed) return null;
        return (
          <button
            type="button"
            onClick={() => setWatching({ ...parsed, sermon_title: w.word })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy bg-white border border-brand-navy/15 rounded-full px-3 py-1.5 hover:bg-brand-sky/70 transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            Watch moment
          </button>
        );
      })()}
    </div>
  );

  const openWord = words.find((w) => w.id === expandedId);

  const list = (
    <div className={embedded ? "" : "px-3 sm:px-4 pb-4 pt-1"}>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <Chip key={w.id} w={w} />
        ))}
      </div>
      {openWord && <Reveal w={openWord} />}
    </div>
  );

  // Embedded (inside a tab): no outer card / toggle — the list stands alone.
  if (embedded)
    return (
      <>
        {list}
        <VideoModal seg={watching} onClose={() => setWatching(null)} />
      </>
    );

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

      {open && list}
      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </div>
  );
}
