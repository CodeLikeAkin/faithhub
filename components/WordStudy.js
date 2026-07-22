"use client";

import { useEffect, useState } from "react";
import { Languages, ChevronDown, ChevronUp, Info, Play, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseYoutubeUrl } from "@/lib/youtube";
import { fetchPassage, parseReference } from "@/lib/bible";
import VideoModal from "@/components/VideoModal";

const LANGUAGE_LABEL = {
  greek: "Greek",
  hebrew: "Hebrew",
  aramaic: "Aramaic",
};

// Strong's kjv_def looks like "X circumcised, circumcision" or "make accepted, be highly favoured" —
// pull out just the first English gloss for the compact strongs-number line.
function primaryEnglishWord(kjvDef) {
  if (!kjvDef) return null;
  return kjvDef
    .replace(/^X\s+/, "")
    .split(/[,;]/)[0]
    .trim() || null;
}

// derivation clauses embed the untranslatable original-script lemma in parens, e.g.
// "from G4059 (περιτέμνω)" — the script is already shown elsewhere on the card, so drop it here.
function stripInlineScript(derivation) {
  if (!derivation) return null;
  return derivation.replace(/\s*\([^)]*\)/g, "").trim() || null;
}

// Highlight the KJV word this study explains within a verse's text. The verse
// is in English, so we match on the primary English gloss (from kjv_def), not
// the transliteration — that's the word actually printed on the page.
function highlightWord(text, needle) {
  if (!needle) return text;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className="bg-brand-navy/15 text-brand-navy font-bold rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

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
  const [verseText, setVerseText] = useState({}); // word id -> { loading }|{ verses }|{ error }
  const [openVerseId, setOpenVerseId] = useState(null); // word id whose verse is expanded

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

  const loadVerse = async (w) => {
    const parsed = parseReference(w.reference);
    if (!parsed) {
      setVerseText((v) => ({ ...v, [w.id]: { error: true } }));
      return;
    }
    setVerseText((v) => ({ ...v, [w.id]: { loading: true } }));
    const passage = await fetchPassage(parsed);
    setVerseText((v) => ({
      ...v,
      [w.id]: passage ? { verses: passage.verses } : { error: true },
    }));
  };

  const toggleVerse = (w) => {
    if (openVerseId === w.id) {
      setOpenVerseId(null);
      return;
    }
    setOpenVerseId(w.id);
    if (!verseText[w.id]) loadVerse(w);
  };

  const Chip = ({ w }) => (
    <button
      onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
      aria-expanded={expandedId === w.id}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-11 text-xs font-bold transition-colors ${
        expandedId === w.id
          ? "bg-brand-navy text-white border-brand-navy"
          : "bg-brand-sky text-brand-navy border-brand-navy/10 hover:border-brand-navy/40"
      }`}
    >
      {w.word}
      <span
        className={`text-xs font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${
          expandedId === w.id ? "bg-white/15 text-white/80" : "bg-brand-navy/5 text-brand-navy/50"
        }`}
      >
        {LANGUAGE_LABEL[w.language] || w.language}
      </span>
    </button>
  );

  const Reveal = ({ w }) => (
    <div className="mt-2.5 rounded-r-2xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-white px-4 sm:px-5 py-4 space-y-2.5">
      {(w.pronunciation || w.phonetic_spelling) && (
        <p className="text-2xl font-bold text-brand-navy">
          {w.pronunciation}
          {w.phonetic_spelling && (
            <span className="text-base font-normal text-brand-navy/60"> [{w.phonetic_spelling}]</span>
          )}
        </p>
      )}
      {w.original_script && (
        <p className="text-sm text-brand-gray">{w.original_script}</p>
      )}
      {w.strongs_number && (
        <span className="inline-block text-xs font-bold uppercase tracking-wider text-brand-navy/60 bg-brand-navy/5 rounded-full px-2 py-0.5">
          Strong&apos;s {w.strongs_number}
          {primaryEnglishWord(w.kjv_def) && (
            <span className="normal-case font-medium text-brand-navy/50"> · {primaryEnglishWord(w.kjv_def)}</span>
          )}
        </span>
      )}
      <p className="text-base leading-relaxed text-brand-ink">
        {[w.meaning?.trim(), w.kjv_def && `— ${w.kjv_def}.`].filter(Boolean).join(" ")}
      </p>
      {w.derivation && (
        <p className="text-xs text-brand-gray italic">{stripInlineScript(w.derivation)}</p>
      )}
      {w.reference && (
        <div>
          <button
            type="button"
            onClick={() => toggleVerse(w)}
            aria-expanded={openVerseId === w.id}
            className="text-xs font-bold uppercase tracking-wider text-brand-navy underline decoration-brand-navy/30 underline-offset-2 hover:decoration-brand-navy"
          >
            {w.reference}
          </button>
          {openVerseId === w.id && (
            <div className="mt-2 rounded-xl bg-white/70 border border-brand-navy/10 px-3 py-2.5">
              {verseText[w.id]?.loading && (
                <span className="flex items-center gap-2 text-xs text-brand-gray">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading verse…
                </span>
              )}
              {verseText[w.id]?.error && (
                <p className="text-xs text-brand-gray italic">
                  Couldn&apos;t load this verse right now.
                </p>
              )}
              {verseText[w.id]?.verses && (
                <p className="text-sm leading-relaxed text-brand-ink normal-case tracking-normal font-normal">
                  {verseText[w.id].verses.map((v) => (
                    <span key={v.number}>
                      <sup className="text-brand-navy/50 font-bold mr-1">{v.number}</sup>
                      {highlightWord(v.text, primaryEnglishWord(w.kjv_def))}{" "}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </div>
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
