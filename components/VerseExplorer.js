"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchPassage, BOOK_ORDER, BOOK_ABBR, TRANSLATIONS } from "@/lib/bible";

/**
 * Verse Explorer — every scripture a sermon opened, grouped by book as chips.
 * Tap a chip to reveal the verse text (fetched lazily from bible.helloao.org)
 * plus the "why it was read" note. Books with 2+ readings get their own
 * group; single readings collect under "Also read". An "As spoken" toggle
 * preserves the sermon's own order for people following along.
 *
 * Accepts preloaded `scriptures` (the sermon page lifts the query to share a
 * count with its hero); self-fetches when the prop is absent. Renders nothing
 * if the sermon has no extracted scriptures yet.
 */
export default function VerseExplorer({ sermonId, scriptures: preloaded }) {
  const [fetched, setFetched] = useState([]);
  const [view, setView] = useState("book"); // "book" | "spoken"
  const [expandedId, setExpandedId] = useState(null);
  const [verseText, setVerseText] = useState({}); // id -> { KJV?, NLT?: {loading}|{verses,translation}|{error} }
  const [shownTranslation, setShownTranslation] = useState({}); // id -> "KJV" | "NLT"

  const scriptures = preloaded ?? fetched;

  useEffect(() => {
    if (preloaded || !sermonId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sermon_scriptures")
        .select("*")
        .eq("sermon_id", sermonId)
        .order("order_index", { ascending: true });
      if (!error && data && !cancelled) setFetched(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [sermonId, preloaded]);

  // Short chip label within a book group: "5:4", "7:37–39", "53".
  const shortRef = (s) => {
    let label = `${s.chapter}`;
    if (s.verse_start) {
      label += `:${s.verse_start}`;
      if (s.verse_end && s.verse_end !== s.verse_start) label += `–${s.verse_end}`;
    }
    return label;
  };

  const groups = useMemo(() => {
    if (!scriptures.length) return { main: [], also: [] };
    const byBook = new Map();
    for (const s of scriptures) {
      if (!byBook.has(s.book)) byBook.set(s.book, []);
      byBook.get(s.book).push(s);
    }
    const order = (b) => {
      const i = BOOK_ORDER.indexOf(b);
      return i === -1 ? 999 : i;
    };
    const main = [];
    const also = [];
    for (const [book, refs] of byBook) {
      if (refs.length >= 2) main.push({ book, refs });
      else also.push(...refs);
    }
    main.sort((a, b) => order(a.book) - order(b.book));
    also.sort((a, b) => order(a.book) - order(b.book) || a.chapter - b.chapter);
    return { main, also };
  }, [scriptures]);

  if (!scriptures.length) return null;

  const loadVerseText = async (s, translation) => {
    setVerseText((v) => ({
      ...v,
      [s.id]: { ...v[s.id], [translation]: { loading: true } },
    }));
    const passage = await fetchPassage(
      {
        book: s.book,
        bookId: s.book_id,
        chapter: s.chapter,
        verseStart: s.verse_start,
        verseEnd: s.verse_end,
      },
      translation
    );
    setVerseText((v) => ({
      ...v,
      [s.id]: {
        ...v[s.id],
        [translation]: passage
          ? { verses: passage.verses, translation: passage.translation }
          : { error: true },
      },
    }));
  };

  const toggleVerse = (s) => {
    if (expandedId === s.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(s.id);
    const t = shownTranslation[s.id] || "KJV";
    if (!verseText[s.id]?.[t]) loadVerseText(s, t);
  };

  const switchTranslation = (s, translation) => {
    setShownTranslation((st) => ({ ...st, [s.id]: translation }));
    if (!verseText[s.id]?.[translation]) loadVerseText(s, translation);
  };

  const Chip = ({ s, label }) => (
    <button
      onClick={() => toggleVerse(s)}
      aria-expanded={expandedId === s.id}
      className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        expandedId === s.id
          ? "bg-brand-navy text-white border-brand-navy"
          : "bg-brand-sky text-brand-navy border-brand-navy/10 hover:border-brand-navy/40"
      }`}
    >
      {label}
    </button>
  );

  const Reveal = ({ s }) => {
    const t = shownTranslation[s.id] || "KJV";
    const vt = verseText[s.id]?.[t];
    return (
      <div className="mt-2.5 rounded-r-2xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-card px-4 sm:px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-brand-navy">{s.reference}</p>
          <span className="flex rounded-full border border-brand-navy/15 p-0.5 flex-shrink-0">
            {TRANSLATIONS.map((tr) => (
              <button
                key={tr}
                onClick={() => switchTranslation(s, tr)}
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold transition-colors ${
                  t === tr
                    ? "bg-brand-navy text-white"
                    : "text-brand-gray hover:text-brand-navy"
                }`}
              >
                {tr}
              </button>
            ))}
          </span>
        </div>
        {vt?.loading && (
          <span className="mt-2 flex items-center gap-2 text-sm text-brand-gray">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading verse…
          </span>
        )}
        {vt?.error && (
          <p className="mt-2 text-sm text-brand-gray italic">
            Couldn&apos;t load this verse right now.
          </p>
        )}
        {vt?.verses && (
          <p className="mt-2 text-[15px] leading-relaxed text-brand-ink">
            {vt.verses.map((v) => (
              <span key={v.number}>
                <sup className="text-brand-navy/50 font-bold mr-1">{v.number}</sup>
                {v.text}{" "}
              </span>
            ))}
          </p>
        )}
        {s.theme && (
          <p className="mt-2.5 text-xs text-brand-gray">
            In this message:{" "}
            <span className="font-semibold text-brand-ink/80">{s.theme}</span>
          </p>
        )}
      </div>
    );
  };

  // A chip row + the reveal for whichever chip in it is expanded.
  const ChipGroup = ({ refs, labelFor }) => {
    const openRef = refs.find((s) => s.id === expandedId);
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {refs.map((s) => (
            <Chip key={s.id} s={s} label={labelFor(s)} />
          ))}
        </div>
        {openRef && <Reveal s={openRef} />}
      </>
    );
  };

  return (
    <div className="rounded-3xl border border-brand-navy/10 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} />
          </span>
          <span>
            <span className="block text-base font-bold text-brand-ink">
              Scriptures in this message
            </span>
            <span className="block text-xs text-brand-gray">
              Tap a verse to read it — the note under each is why it was read
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          <span className="flex rounded-full border border-brand-navy/15 p-0.5">
            {[
              ["book", "By book"],
              ["spoken", "As spoken"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors ${
                  view === key
                    ? "bg-brand-navy text-white"
                    : "text-brand-gray hover:text-brand-navy"
                }`}
              >
                {label}
              </button>
            ))}
          </span>
          <span className="text-xs font-bold text-brand-navy bg-brand-sky border border-brand-navy/15 rounded-full px-2.5 py-1">
            {scriptures.length}
          </span>
        </span>
      </div>

      {view === "book" ? (
        <div className="mt-5 space-y-5">
          {groups.main.map(({ book, refs }) => (
            <div key={book}>
              <p className="mb-2 flex items-baseline gap-2">
                <span className="text-[13.5px] font-bold text-brand-ink">{book}</span>
                <span className="text-[11px] font-bold text-brand-gray">
                  · {refs.length} readings
                </span>
              </p>
              <ChipGroup refs={refs} labelFor={shortRef} />
            </div>
          ))}
          {groups.also.length > 0 && (
            <div>
              <p className="mb-2 flex items-baseline gap-2">
                <span className="text-[13.5px] font-bold text-brand-ink">Also read</span>
                <span className="text-[11px] font-bold text-brand-gray">
                  · {groups.also.length} across {groups.also.length}{" "}
                  {groups.also.length === 1 ? "book" : "books"}
                </span>
              </p>
              <ChipGroup
                refs={groups.also}
                labelFor={(s) => `${BOOK_ABBR[s.book] || s.book} ${shortRef(s)}`}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <ChipGroup refs={scriptures} labelFor={(s) => s.reference} />
        </div>
      )}
    </div>
  );
}
