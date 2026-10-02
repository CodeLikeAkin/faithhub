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
export default function BibleNav({ selectedId, className, variant = "list" }) {
  const { data: stats } = useLoad(loadBookStats, []);
  const max = Math.max(1, ...Object.values(stats || {}).map((s) => s.sermons));

  // Tiles: the same map as a heatmap grid (like a book's chapter grid), for a
  // phone — 66 bar rows ran two and a half screens before anything else.
  if (variant === "tiles") {
    return (
      <nav aria-label="Books of the Bible" className={className}>
        {SECTIONS.map((sec) => (
          <section key={sec.name} className="mt-6 first:mt-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-brand-gray">{sec.name}</h3>
            <ul className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {sec.books.map((b) => {
                const s = stats?.[b.id];
                // Square-root scaled and capped at 0.45 so dark ink stays legible on every tile.
                const weight = s ? 0.06 + 0.39 * Math.sqrt(s.sermons / max) : 0;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/word/${b.slug}`}
                      title={s ? `${b.name}: ${s.sermons} messages` : `${b.name}: not preached yet`}
                      style={s ? { backgroundColor: `rgba(23, 58, 104, ${weight.toFixed(3)})` } : undefined}
                      className={cn(
                        "flex h-12 items-center justify-center rounded-xl px-1.5 text-center text-[13px] font-medium leading-tight text-balance transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
                        s ? "text-brand-ink" : "bg-brand-navy/[0.04] text-brand-gray"
                      )}
                    >
                      {b.name}
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

  return (
    <nav aria-label="Books of the Bible" className={cn("px-3 py-6", className)}>
      {SECTIONS.map((sec) => (
        <section key={sec.name} className="mb-7 last:mb-0">
          <h2 className="px-2 font-display text-xl font-semibold text-brand-ink">{sec.name}</h2>
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
