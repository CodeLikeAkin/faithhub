"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { STARTER_QUESTIONS } from "@/lib/ask-examples";
import { THEMES, fetchThemeCount } from "@/lib/declarations";
import { loadBookStats, useLoad } from "@/lib/word-data";
import { bookFromId } from "@/lib/canon";
import { seriesName } from "@/lib/titles";

// min-w-0: a grid cell otherwise refuses to shrink below its longest
// single-line title, which widened the whole page on phones.
const card =
  "flex h-full min-w-0 flex-col rounded-[1.75rem] border border-brand-navy/10 bg-white p-6 transition-[border-color,box-shadow] duration-200 hover:border-brand-navy/20 hover:shadow-[0_30px_50px_-40px_rgba(23,58,104,0.5)] sm:p-7";

function CardHead({ title, desc }) {
  return (
    <>
      <h3 className="font-display text-2xl font-medium text-brand-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-gray">{desc}</p>
    </>
  );
}

function CardFoot({ href, label }) {
  return (
    <Link href={href} className="group mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-brand-navy">
      {label} <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const rowLink =
  "group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-brand-ink transition-colors hover:bg-brand-sky/70";

/**
 * Home: the four tools, each showing something real from inside it — questions
 * to ask, themes with their counts, the newest series, the most-preached books.
 */
export default function FeatureCards() {
  const [counts, setCounts] = useState({});
  const [series, setSeries] = useState(null);
  const { data: bookStats } = useLoad(loadBookStats, []);
  const themes = THEMES.slice(0, 4);

  useEffect(() => {
    let live = true;
    Promise.all(themes.map((t) => fetchThemeCount(t.slug).then((n) => [t.slug, n]))).then(
      (pairs) => live && setCounts(Object.fromEntries(pairs))
    );
    supabase
      .from("series")
      .select("id, title, series_sermons ( part_number )")
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(3)
      .then(({ data }) => live && setSeries(data || []));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topBooks = bookStats
    ? Object.entries(bookStats)
        .map(([id, s]) => ({ book: bookFromId(id), ...s }))
        .filter((b) => b.book)
        .sort((a, b) => b.sermons - a.sermons)
        .slice(0, 3)
    : [];
  const maxBook = Math.max(1, ...topBooks.map((b) => b.sermons));

  return (
    <section aria-labelledby="tools-heading" className="mx-auto max-w-[1400px] px-4 pt-14 sm:px-6 sm:pt-20">
      <h2 id="tools-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink sm:text-4xl">
        Go deeper
      </h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <li className={card}>
          <CardHead title="Ask the Word" desc="Any question, answered from Rev. Peter’s own words, with the moments to watch." />
          <ul className="-mx-3 mt-4">
            {STARTER_QUESTIONS.slice(0, 3).map((q) => (
              <li key={q}>
                <Link href={`/ask?q=${encodeURIComponent(q)}`} className={rowLink}>
                  <span>{q}</span>
                  <ArrowRight size={14} aria-hidden="true" className="flex-shrink-0 text-brand-navy/40 group-hover:text-brand-navy" />
                </Link>
              </li>
            ))}
          </ul>
          <CardFoot href="/ask?new=1" label="Ask a question" />
        </li>

        <li className={card}>
          <CardHead title="Declarations" desc="Words to speak over your life, gathered by what you’re facing." />
          <ul className="-mx-3 mt-4">
            {themes.map((t) => (
              <li key={t.slug}>
                <Link href={`/declarations/${t.slug}`} className={rowLink}>
                  <span className="font-display text-lg">{t.name}</span>
                  <span className="text-xs tabular-nums text-brand-gray">
                    {counts[t.slug] != null ? counts[t.slug].toLocaleString() : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <CardFoot href="/declarations" label="All themes" />
        </li>

        <li className={card}>
          <CardHead title="Series Study" desc="Each series as a course: watch, read the notes, and ask as you go." />
          <ul className="-mx-3 mt-4">
            {(series || []).map((s) => (
              <li key={s.id}>
                <Link href={`/series/${s.id}`} className={rowLink}>
                  <span className="min-w-0 truncate font-display text-lg">{seriesName(s.title)}</span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-brand-gray">{s.series_sermons?.length || 0} parts</span>
                </Link>
              </li>
            ))}
            {series === null && [0, 1, 2].map((i) => <li key={i} aria-hidden="true" className="mx-3 my-3 h-4 rounded-full bg-brand-sky motion-safe:animate-pulse" />)}
          </ul>
          <CardFoot href="/series" label="Browse the series" />
        </li>

        <li className={card}>
          <CardHead title="The Word" desc="Every scripture he has opened, mapped across the Bible." />
          <ul className="mt-5 space-y-3.5">
            {topBooks.map((b) => (
              <li key={b.book.id}>
                <Link href={`/word/${b.book.slug}`} className="group block">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-lg text-brand-ink group-hover:text-brand-navy">{b.book.name}</span>
                    <span className="text-xs tabular-nums text-brand-gray">{b.sermons} messages</span>
                  </span>
                  <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-brand-navy/[0.06]">
                    <span className="block h-full rounded-full bg-brand-navy/70" style={{ width: `${(b.sermons / maxBook) * 100}%` }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <CardFoot href="/word" label="Open The Word" />
        </li>
      </ul>
    </section>
  );
}
