"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { byRecent, useStudies } from "@/lib/studies";
import { readLastLesson } from "@/lib/recent";
import YtThumb from "@/components/YtThumb";
import { fmtDate } from "@/lib/ask-format";
import { displayTitle } from "@/lib/titles";

/**
 * Home, for returning visitors: the lesson (or series) they last opened and
 * their latest studies. Renders nothing for a first visit.
 */
export default function ContinueRow() {
  const { studies, ready } = useStudies();
  const [last, setLast] = useState(null);
  useEffect(() => setLast(readLastLesson()), []);

  const recent = byRecent(studies).slice(0, last ? 2 : 3);
  if (!ready || (!last && !recent.length)) return null;

  return (
    <section aria-labelledby="continue-heading" className="mx-auto max-w-[1400px] px-4 pt-14 sm:px-6 sm:pt-20">
      <h2 id="continue-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink sm:text-4xl">
        Pick up where you left off
      </h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {last && (
          <li className="min-w-0">
            <Link
              href={last.href}
              className="group flex h-full items-center gap-4 rounded-[1.5rem] border border-brand-navy/10 bg-white p-3 pr-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0_24px_50px_-35px_rgba(23,58,104,0.5)]"
            >
              <span className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-xl bg-brand-deep">
                <YtThumb ids={last.videoIds || last.videoId} quality="mqdefault" className="h-full w-full object-cover opacity-90" />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-brand-navy">
                    <Play size={12} fill="currentColor" className="translate-x-px" aria-hidden="true" />
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-brand-gray">
                  {last.kind === "lesson" && last.partNumber && last.seriesTitle
                    ? `Part ${last.partNumber} of ${last.parts} · ${displayTitle(last.seriesTitle)}`
                    : last.kind === "series"
                    ? `Series · ${last.parts} parts`
                    : "Message"}
                </span>
                {/* No `block` beside line-clamp-* — it overrides the -webkit-box
                    display the clamp needs, and the text spills instead of clamping. */}
                <span className="mt-0.5 line-clamp-2 font-display text-xl font-medium leading-snug text-brand-ink">
                  {displayTitle(last.title)}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-navy">
                  Continue <ArrowRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          </li>
        )}
        {recent.map((s) => (
          <li key={s.id}>
            <Link
              href={`/ask?study=${s.id}`}
              className="group flex h-full flex-col rounded-[1.5rem] border border-brand-navy/10 bg-white p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0_24px_50px_-35px_rgba(23,58,104,0.5)]"
            >
              <span className="text-xs text-brand-gray">
                Your study · {displayTitle(s.context?.seriesTitle) || "Everything"} · {fmtDate(s.updatedAt)}
              </span>
              <span className="mt-1.5 line-clamp-2 font-display text-xl font-medium leading-snug text-brand-ink">{s.title}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-brand-navy">
                {s.blocks.length} {s.blocks.length === 1 ? "question" : "questions"}
                <ArrowRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
