"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import VerseCard, { TranslationToggle } from "@/components/VerseCard";
import { DotGrid, Eyebrow } from "@/components/Decor";
import Masthead from "@/components/shell/Masthead";
import BibleNav from "./BibleNav";

const fmt = (n) => Number(n || 0).toLocaleString();

/** A section opener in the Vision page's manner: eyebrow, display heading, note, a rule that fades out. */
function SectionHead({ id, eyebrow, title, note, action }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 id={id} className="mt-3 font-display text-2xl font-medium leading-[1.08] tracking-tight text-brand-ink text-balance sm:text-3xl">
            {title}
          </h2>
          {note && <p className="mt-2 text-sm text-brand-gray">{note}</p>}
        </div>
        {action}
      </div>
      <div aria-hidden="true" className="mt-5 h-px bg-gradient-to-r from-brand-navy/30 via-brand-navy/10 to-transparent" />
    </>
  );
}

/**
 * /word with nothing selected: the headline numbers, then — below xl, where
 * there's no left pane — the whole Bible to browse, then the passages and
 * chapters Rev. Peter returns to most and the books he preaches from most.
 */
export default function WordLanding({ stats }) {
  const [translation, setTranslation] = useState("KJV");
  const maxBook = Math.max(1, ...(stats?.books || []).map((b) => b.messages));
  const maxChapter = Math.max(1, ...(stats?.chapters || []).map((c) => c.messages));

  return (
    <div className="relative isolate overflow-hidden pb-24">
      {/* The Vision page's backdrop: a sky wash under the header and dot grids
          pinned to opposite edges, fading inward. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[22rem] -z-10 h-[70rem] bg-gradient-to-b from-white via-brand-sky/70 to-white" />
      <DotGrid className="left-0 top-[26rem] -z-10 h-[32rem] w-[32rem] max-w-full [mask-image:radial-gradient(circle_at_left,black,transparent_65%)]" />
      <DotGrid className="right-0 top-[64rem] -z-10 h-[30rem] w-[30rem] max-w-full [mask-image:radial-gradient(circle_at_right,black,transparent_65%)]" />

      {/* The same masthead Ask, Series and Declarations open with. */}
      <Masthead
        className="px-4 pt-3 sm:px-6 sm:pt-6"
        eyebrow="Mapped across the Bible"
        title={
          <>
            The <em>Word</em>
          </>
        }
        description="Every scripture Rev. Peter has opened in his messages, mapped across the Bible."
      >
            {stats && (
              <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  { value: fmt(stats.totals.refs), label: "scriptures opened", short: "scriptures" },
                  { value: fmt(stats.totals.messages), label: "messages" },
                  { value: `${stats.totals.books} of 66`, label: "books" },
                ].map(({ value, label, short }) => (
                  <div key={label} className="rounded-2xl bg-white/[0.07] px-3 py-3 ring-1 ring-white/10 sm:px-4">
                    <dt className="sr-only">{label}</dt>
                    <dd>
                      {/* "65 of 66" is the long one — it has to sit on one line beside the counts. */}
                      <span className="block whitespace-nowrap font-display text-lg font-medium tabular-nums sm:text-2xl lg:text-3xl">
                        {value}
                      </span>
                      {/* A phone can't fit "scriptures opened" on one line next to the
                          other two, and the wrap left the row ragged. The full label is
                          still what a screen reader gets, from <dt> above. */}
                      <span className="block text-xs text-white/60 sm:text-sm">
                        <span className="sm:hidden">{short || label}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
      </Masthead>

      <div className="mx-auto max-w-4xl px-4 sm:px-8">
        {/* Browsing comes first: someone opening The Word wants to go to a verse,
            not read the rankings. Above xl the left pane already holds the nav. */}
        <section aria-labelledby="browse-heading" className="pt-10 xl:hidden">
          <SectionHead
            id="browse-heading"
            eyebrow="66 books"
            title="Browse the Bible"
            note="Tap a book to open its chapters. The darker it is, the more he preaches from it."
          />
          <BibleNav variant="tiles" className="mt-6" />
        </section>

        {stats?.passages?.length > 0 && (
          <section aria-labelledby="passages-heading" className="pt-14">
            <SectionHead
              id="passages-heading"
              eyebrow="Opened most often"
              title="Most-preached passages"
              note="The verses he opens in the most messages"
              action={<TranslationToggle value={translation} onChange={setTranslation} />}
            />
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {stats.passages.map((p) => (
                <li key={p.label}>
                  <Link
                    href={`/word/${p.slug}/${p.chapter}#v${p.verseStart}`}
                    className="block h-full rounded-2xl transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
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
            <SectionHead id="chapters-heading" eyebrow="Returned to" title="Chapters Rev. Peter returns to" />
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
            <SectionHead id="books-heading" eyebrow="Ranked" title="The books he preaches from most" />
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {stats.books.map((b, i) => (
                <li key={b.id}>
                  <Link
                    href={`/word/${b.slug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-brand-navy/10 bg-white p-4 shadow-subtle transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-lift active:scale-[0.99]"
                  >
                    <span className="w-8 text-right font-display text-2xl leading-none tabular-nums text-brand-navy/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
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
      </div>
    </div>
  );
}
