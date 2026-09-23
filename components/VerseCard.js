"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchPassage, TRANSLATIONS } from "@/lib/bible";
import { cn } from "@/lib/utils";

/**
 * A scripture with its text — KJV live from bible.helloao.org, NLT from the
 * local bible_nlt table (both via lib/bible.js fetchPassage). Used in the
 * answer margin and the series overview's key verses.
 *
 * Verse text is cached per passage + translation for the session, so the
 * same verse cited in five answers is fetched once.
 */

const cache = new Map(); // key -> Promise<{ verses } | { error }>

const keyFor = (p, translation) =>
  `${p.bookId || p.book}|${p.chapter}|${p.verseStart || ""}|${p.verseEnd || ""}|${translation}`;

function loadPassage(passage, translation) {
  const key = keyFor(passage, translation);
  if (!cache.has(key)) {
    const pending = fetchPassage(passage, translation)
      .then((r) => (r?.verses?.length ? { verses: r.verses } : { error: true }))
      .catch(() => ({ error: true }));
    cache.set(key, pending);
    pending.then((r) => r.error && cache.delete(key)); // let a later render retry
  }
  return cache.get(key);
}

function useVerseText(passage, translation) {
  const key = passage ? keyFor(passage, translation) : null;
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!passage) {
      setState({ error: true });
      return;
    }
    let live = true;
    setState({ loading: true });
    loadPassage(passage, translation).then((r) => live && setState(r));
    return () => {
      live = false;
    };
    // `key` captures everything about the passage that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function TranslationToggle({ value, onChange, className }) {
  return (
    <span
      role="radiogroup"
      aria-label="Bible translation"
      className={cn("inline-flex rounded-full border border-brand-navy/15 bg-white p-0.5", className)}
    >
      {TRANSLATIONS.map((tr) => (
        <button
          key={tr}
          type="button"
          role="radio"
          aria-checked={value === tr}
          onClick={() => onChange(tr)}
          className={cn(
            "relative rounded-full px-2.5 py-1 text-xs font-bold transition-colors before:absolute before:-inset-2 before:content-['']",
            value === tr ? "bg-brand-navy text-white" : "text-brand-gray hover:text-brand-navy"
          )}
        >
          {tr}
        </button>
      ))}
    </span>
  );
}

/**
 * passage = { book, bookId, chapter, verseStart?, verseEnd?, wholeChapter? }
 * A whole-chapter reference shows its opening verses only.
 */
export default function VerseCard({
  id,
  reference,
  passage,
  translation = "KJV",
  meta,
  highlighted = false,
  maxVerses = 5,
  className,
}) {
  const vt = useVerseText(passage, translation);
  const limit = passage?.wholeChapter ? 3 : maxVerses;
  const verses = vt.verses || [];
  const shown = verses.slice(0, limit);
  const trimmed = verses.length > shown.length;

  return (
    <figure
      id={id}
      className={cn(
        "rounded-2xl px-4 py-3.5 transition-[background-color,box-shadow] duration-300",
        highlighted ? "bg-brand-sky ring-2 ring-brand-navy/40" : "bg-brand-sky/60",
        className
      )}
    >
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-brand-navy">{reference}</span>
        {meta && <span className="flex-shrink-0 text-xs text-brand-gray">{meta}</span>}
      </figcaption>
      {vt.loading && (
        <p className="mt-2 flex items-center gap-2 text-sm text-brand-gray">
          <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
          Loading verse…
        </p>
      )}
      {vt.error && (
        <p className="mt-2 text-sm italic text-brand-gray">Couldn&rsquo;t load this verse right now.</p>
      )}
      {shown.length > 0 && (
        <blockquote className="mt-2 font-display text-base leading-relaxed text-brand-ink">
          {shown.map((v) => (
            <span key={v.number}>
              <sup className="mr-1 font-sans text-xs font-bold text-brand-navy/50">{v.number}</sup>
              {v.text}{" "}
            </span>
          ))}
          {trimmed && <span className="text-brand-gray">…</span>}
        </blockquote>
      )}
    </figure>
  );
}
