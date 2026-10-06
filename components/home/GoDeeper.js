"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Flame, ScrollText, Sparkles } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { STARTER_QUESTIONS } from "@/lib/ask-examples";
import { loadBookStats, useLoad } from "@/lib/word-data";
import { BOOKS } from "@/lib/canon";
import { Eyebrow } from "@/components/Decor";

const count = async (table) => {
  const { count: n, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return error ? null : n;
};

async function fetchNewestCovers() {
  const { data } = await supabase
    .from("series")
    .select("id, series_sermons ( part_number, sermons ( youtube_video_id ) )")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(3);
  return (data || [])
    .map((s) => [...(s.series_sermons || [])].sort((a, b) => a.part_number - b.part_number).map((p) => p.sermons?.youtube_video_id).filter(Boolean))
    .filter((ids) => ids.length);
}

const fmt = (n) => (n == null ? "" : n.toLocaleString("en-US"));

/* Styled after the Vision page's "component" cards: navy icon tile, a faint
   index numeral, and a sky glow in the corner that swells on hover. */
function Tool({ href, index, icon: Icon, title, desc, foot, style }) {
  return (
    <Link
      href={href}
      style={style}
      className="fh-rise group relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[1.75rem] border border-brand-navy/10 bg-white p-5 shadow-card transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-brand-navy/20 hover:shadow-lift active:scale-[0.99] sm:gap-2.5 sm:p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-sky blur-2xl transition-transform duration-500 group-hover:scale-125"
      />
      <span className="relative flex items-start justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-navy text-white shadow-lg shadow-brand-navy/20">
          <Icon size={19} aria-hidden="true" />
        </span>
        <span aria-hidden="true" className="font-display text-3xl leading-none text-brand-navy/60">
          {index}
        </span>
      </span>
      <span className="relative mt-2 font-display text-2xl font-medium leading-tight text-brand-ink">{title}</span>
      <span className="relative text-sm leading-relaxed text-brand-gray">{desc}</span>
      <span className="relative mt-auto flex items-center justify-between gap-3 pt-2 text-sm text-brand-gray">
        {foot}
        <ArrowRight size={16} aria-hidden="true" className="flex-shrink-0 text-brand-navy transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** Home: the four ways into the teaching, each with a live number from inside it. */
export default function GoDeeper({ startIndex = 0 }) {
  const [stats, setStats] = useState({});
  const [covers, setCovers] = useState([]);
  const { data: bookStats } = useLoad(loadBookStats, []);

  useEffect(() => {
    let live = true;
    Promise.all([count("declarations"), count("series"), count("sermon_scriptures")]).then(
      ([declarations, series, scriptures]) => live && setStats({ declarations, series, scriptures })
    );
    fetchNewestCovers().then((c) => live && setCovers(c));
    return () => {
      live = false;
    };
  }, []);

  // Every book in Bible order, as a tiny bar chart of how often it's opened.
  const bars = bookStats ? BOOKS.map((b) => bookStats[b.id]?.sermons || 0) : [];
  const maxBar = Math.max(1, ...bars);
  const i = (n) => ({ "--i": startIndex + n });

  return (
    <section>
      <Eyebrow>Go deeper</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-medium leading-[1.08] tracking-tight text-brand-ink text-balance sm:text-4xl">
        Four ways into the{" "}
        <em className="font-normal italic text-brand-navy">teaching</em>
      </h2>
      <div aria-hidden="true" className="mt-6 h-px bg-gradient-to-r from-brand-navy/30 via-brand-navy/10 to-transparent" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Tool
          style={i(0)}
          index="01"
          href={`/ask?q=${encodeURIComponent(STARTER_QUESTIONS[0])}`}
          icon={Sparkles}
          title="Ask the Word"
          desc="Any question, answered from Rev. Peter’s and Pastor Funlola’s own words, with the moments to watch."
          foot={<span className="truncate italic">&ldquo;{STARTER_QUESTIONS[0]}&rdquo;</span>}
        />
        <Tool
          style={i(1)}
          index="02"
          href="/declarations"
          icon={Flame}
          title="Declarations"
          desc="Words to speak over your life, gathered by what you’re facing."
          foot={
            <span>
              <b className="font-semibold tabular-nums text-brand-ink">{fmt(stats.declarations)}</b> declarations
            </span>
          }
        />
        <Tool
          style={i(2)}
          index="03"
          href="/series"
          icon={BookOpen}
          title="Series Study"
          desc="Each series as a course: watch, read the notes, and ask as you go."
          foot={
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex flex-shrink-0">
                {covers.map((ids, n) => (
                  <span key={n} className="relative -mr-3 h-9 w-12 overflow-hidden rounded-lg border-2 border-white bg-brand-deep">
                    <YtThumb ids={ids} quality="mqdefault" className="h-full w-full object-cover" />
                  </span>
                ))}
              </span>
              <span className="whitespace-nowrap pl-3">
                <b className="font-semibold tabular-nums text-brand-ink">{fmt(stats.series)}</b> series
              </span>
            </span>
          }
        />
        <Tool
          style={i(3)}
          index="04"
          href="/word"
          icon={ScrollText}
          title="The Word"
          desc="Every scripture he has opened, mapped across the Bible."
          foot={
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span aria-hidden="true" className="flex h-7 flex-1 items-end gap-px">
                {bars.map((v, n) => (
                  <span key={n} className="flex-1 rounded-t-sm bg-brand-navy/75" style={{ height: `${Math.max(4, (v / maxBar) * 100)}%` }} />
                ))}
              </span>
              <span className="flex-shrink-0">
                <b className="font-semibold tabular-nums text-brand-ink">{fmt(stats.scriptures)}</b>
              </span>
            </span>
          }
        />
      </div>
    </section>
  );
}
