"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import VerseCard, { TranslationToggle } from "@/components/VerseCard";
import { DotGrid, Rings } from "@/components/Decor";
import BibleNav from "./BibleNav";

const fmt = (n) => Number(n || 0).toLocaleString();

/**
 * /word with nothing selected: the headline numbers, the passages and
 * chapters Rev. Peter returns to most, the books he preaches from most — and,
 * below xl (where there's no left pane), the whole Bible to browse.
 */
export default function WordLanding({ stats }) {
  const [translation, setTranslation] = useState("KJV");
  const maxBook = Math.max(1, ...(stats?.books || []).map((b) => b.messages));
  const maxChapter = Math.max(1, ...(stats?.chapters || []).map((c) => c.messages));

  return (
    <div className="pb-24">
      <div className="px-3 pt-3 sm:px-6 sm:pt-6">
        <section className="relative overflow-hidden rounded-[1.75rem] bg-brand-deep px-6 py-10 text-white sm:rounded-[2.5rem] sm:px-10 sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 -top-40 h-[26rem] w-[26rem] rounded-full bg-brand-navy blur-3xl" />
            <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]" />
            <Rings className="absolute -bottom-56 -right-48 h-[34rem] w-[34rem] text-white/[0.06]" />
          </div>
          <div className="relative">
            <h1 className="font-display text-5xl font-medium tracking-tight sm:text-6xl">The Word</h1>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-white/75">
              Every scripture Rev. Peter has opened in his messages, mapped across the Bible.
            </p>
            {stats && (
              <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  [fmt(stats.totals.refs), "scriptures opened"],
                  [fmt(stats.totals.messages), "messages"],
                  [`${stats.totals.books} of 66`, "books"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
                    <dt className="sr-only">{label}</dt>
                    <dd>
                      <span className="block font-display text-2xl font-medium tabular-nums sm:text-3xl">{value}</span>
                      <span className="block text-xs text-white/60 sm:text-sm">{label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-8">
        {stats?.passages?.length > 0 && (
          <section aria-labelledby="passages-heading" className="pt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="passages-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink">
                  Most-preached passages
                </h2>
                <p className="mt-1.5 text-sm text-brand-gray">The verses he opens in the most messages</p>
              </div>
              <TranslationToggle value={translation} onChange={setTranslation} />
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {stats.passages.map((p) => (
                <li key={p.label}>
                  <Link
                    href={`/word/${p.slug}/${p.chapter}#v${p.verseStart}`}
                    className="block h-full rounded-2xl transition-shadow hover:shadow-[0_20px_40px_-28px_rgba(23,58,104,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    <VerseCard
                      reference={p.label}
                      passage={{ book: p.name, bookId: p.id, chapter: p.chapter, verseStart: p.verseStart, verseEnd: p.verseEnd }}
                      translation={translation}
                      meta={`${p.messages} messages`}
                      maxVerses={3}
                      className="h-full"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {stats?.chapters?.length > 0 && (
          <section aria-labelledby="chapters-heading" className="pt-14">
            <h2 id="chapters-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink">
              Chapters Rev returns to
            </h2>
            <ul className="mt-6 space-y-2">
              {stats.chapters.map((c) => (
                <li key={`${c.id}-${c.chapter}`}>
                  <Link
                    href={`/word/${c.slug}/${c.chapter}`}
                    className="group grid grid-cols-[7.5rem_1fr_auto] items-center gap-4 rounded-xl px-2 py-2 transition-colors hover:bg-brand-sky/60 sm:grid-cols-[10rem_1fr_auto]"
                  >
                    <span className="font-display text-xl text-brand-ink">
                      {c.name} {c.chapter}
                    </span>
                    <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-brand-navy/[0.06]">
                      <span className="block h-full rounded-full bg-brand-navy/70 group-hover:bg-brand-navy" style={{ width: `${(c.messages / maxChapter) * 100}%` }} />
                    </span>
                    <span className="text-sm tabular-nums text-brand-gray">{c.messages} messages</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {stats?.books?.length > 0 && (
          <section aria-labelledby="books-heading" className="pt-14">
            <h2 id="books-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink">
              The books Rev preaches from most
            </h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {stats.books.map((b, i) => (
                <li key={b.id}>
                  <Link
                    href={`/word/${b.slug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-brand-navy/10 bg-white p-4 transition-[border-color,box-shadow] hover:border-brand-navy/25 hover:shadow-[0_20px_40px_-30px_rgba(23,58,104,0.45)]"
                  >
                    <span className="w-6 text-right font-display text-xl tabular-nums text-brand-navy/40">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-xl text-brand-ink">{b.name}</span>
                        <span className="text-xs tabular-nums text-brand-gray">{b.messages} messages</span>
                      </span>
                      <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-brand-navy/[0.06]">
                        <span className="block h-full rounded-full bg-brand-navy/70" style={{ width: `${(b.messages / maxBook) * 100}%` }} />
                      </span>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" className="flex-shrink-0 text-brand-navy/40 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-navy" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-labelledby="browse-heading" className="pt-14 xl:hidden">
          <h2 id="browse-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink">
            Browse the Bible
          </h2>
          <p className="mt-1.5 text-sm text-brand-gray">Each bar is how many messages open that book</p>
          <BibleNav className="-mx-3 mt-2" />
        </section>
      </div>
    </div>
  );
}
