"use client";

import Link from "next/link";
import { SECTIONS } from "@/lib/canon";
import { loadBookStats, useLoad } from "@/lib/word-data";
import { cn } from "@/lib/utils";

/**
 * The Bible as a navigator, grouped by canon section. Each book carries a
 * bar for how many messages open it (square-root scaled, so Obadiah's two
 * still show next to the Psalms' five hundred).
 */
export default function BibleNav({ selectedId, className }) {
  const { data: stats } = useLoad(loadBookStats, []);
  const max = Math.max(1, ...Object.values(stats || {}).map((s) => s.sermons));

  return (
    <nav aria-label="Books of the Bible" className={cn("px-3 py-6", className)}>
      {SECTIONS.map((sec) => (
        <section key={sec.name} className="mb-7 last:mb-0">
          <h2 className="px-2 font-display text-xl font-medium text-brand-ink">{sec.name}</h2>
          <p className="px-2 text-xs text-brand-gray">{sec.range}</p>
          <ul className="mt-2 space-y-px">
            {sec.books.map((b) => {
              const s = stats?.[b.id];
              const width = s ? Math.max(4, Math.sqrt(s.sermons / max) * 100) : 0;
              const current = b.id === selectedId;
              return (
                <li key={b.id}>
                  <Link
                    href={`/word/${b.slug}`}
                    aria-current={current ? "page" : undefined}
                    title={s ? `${b.name}: ${s.sermons} messages, ${s.refs} references` : `${b.name}: not preached yet`}
                    className={cn(
                      "grid grid-cols-[minmax(0,7.5rem)_1fr_2.25rem] items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      current
                        ? "bg-brand-sky font-semibold text-brand-navy"
                        : s
                        ? "text-brand-ink hover:bg-brand-sky/60"
                        : "text-brand-gray/70 hover:bg-brand-sky/40"
                    )}
                  >
                    <span className="truncate">{b.name}</span>
                    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-brand-navy/[0.06]">
                      <span
                        className={cn("block h-full rounded-full transition-[width] duration-500", current ? "bg-brand-navy" : "bg-brand-navy/60")}
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="text-right text-xs tabular-nums text-brand-gray">{s ? s.sermons : stats ? "–" : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
