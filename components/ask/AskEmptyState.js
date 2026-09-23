"use client";

import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { fmtDate, plainText } from "@/lib/ask-format";
import { EXAMPLE_THEMES } from "@/lib/ask-examples";
import { byRecent } from "@/lib/studies";
import { displayTitle } from "@/lib/titles";
import { DotGrid, Rings } from "@/components/Decor";
import Composer from "./Composer";

export const studyWhere = (s) => displayTitle(s.context?.seriesTitle || s.context?.sermonTitle) || "Everything";

function studySnippet(s) {
  const answered = s.blocks.find((b) => b.status === "done" && Object.keys(b.segmentMap || {}).length);
  const text = answered ? plainText(answered.answer).split(/\n+/)[0] : s.blocks.map((b) => b.question).join(" · ");
  return text.length > 170 ? `${text.slice(0, 170).trimEnd()}…` : text;
}

/** /ask with nothing open: a big search box, example questions by theme, recent studies. */
export default function AskEmptyState({ onAsk, busy, studies, inputRef, onDeleteStudy }) {
  const recent = byRecent(studies).slice(0, 6);

  return (
    <div className="relative">
      <section className="relative overflow-hidden px-4 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-brand-sky to-white" />
          <DotGrid className="inset-x-0 top-0 h-[28rem] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <Rings className="absolute -right-48 -top-48 h-[36rem] w-[36rem] text-brand-navy/[0.07]" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">
            Ask the Word
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-brand-gray">
            Ask anything Rev. Peter has taught. Every answer comes from his recorded
            messages, with the moments to watch.
          </p>
          <div className="mt-9 text-left">
            <Composer
              variant="hero"
              onSubmit={onAsk}
              busy={busy}
              placeholder="What’s on your heart today?"
              inputRef={inputRef}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="examples-heading" className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
        <h2 id="examples-heading" className="font-display text-2xl font-medium text-brand-ink sm:text-3xl">
          Start with a question
        </h2>
        <div className="mt-7 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLE_THEMES.map((t) => (
            <div key={t.title}>
              <h3 className="text-base font-bold text-brand-ink">{t.title}</h3>
              <p className="mt-0.5 text-sm text-brand-gray">{t.blurb}</p>
              <ul className="mt-3 divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                {t.questions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => onAsk(q)}
                      disabled={busy}
                      className="group flex w-full items-start justify-between gap-3 py-3 text-left text-sm leading-snug text-brand-ink transition-colors hover:text-brand-navy disabled:opacity-50"
                    >
                      <span>{q}</span>
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                        className="mt-0.5 flex-shrink-0 text-brand-navy/35 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-navy"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="studies-heading" className="mx-auto max-w-5xl px-4 pb-20 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="studies-heading" className="font-display text-2xl font-medium text-brand-ink sm:text-3xl">
              Your studies
            </h2>
            <p className="text-sm text-brand-gray">Saved on this device</p>
          </div>
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((s) => (
              <li key={s.id} className="group relative">
                <Link
                  href={`/ask?study=${s.id}`}
                  className="flex h-full flex-col rounded-[1.5rem] border border-brand-navy/10 bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0_24px_50px_-30px_rgba(23,58,104,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                >
                  <span className="pr-8 text-xs text-brand-gray">
                    {studyWhere(s)} · {fmtDate(s.updatedAt)}
                  </span>
                  <span className="mt-2 font-display text-xl font-medium leading-snug text-brand-ink">
                    {s.title}
                  </span>
                  <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-brand-gray">
                    {studySnippet(s)}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-navy">
                    {s.blocks.length} {s.blocks.length === 1 ? "question" : "questions"}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => onDeleteStudy(s.id)}
                  aria-label={`Delete study: ${s.title}`}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-brand-gray opacity-0 transition-opacity hover:bg-brand-sky hover:text-brand-navy focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
