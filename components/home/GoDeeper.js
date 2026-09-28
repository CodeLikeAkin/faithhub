"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Flame, ScrollText, Sparkles } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { STARTER_QUESTIONS } from "@/lib/ask-examples";
import { loadBookStats, useLoad } from "@/lib/word-data";
import { BOOKS } from "@/lib/canon";

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

function Tool({ href, icon: Icon, title, desc, foot, style }) {
  return (
    <Link
      href={href}
      style={style}
      className="fh-rise group flex min-w-0 flex-col gap-2.5 rounded-[1.5rem] border border-brand-navy/10 bg-white p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-brand-navy/40 hover:shadow-[0_24px_40px_-30px_rgba(23,58,104,0.55)]"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-sky text-brand-navy">
        <Icon size={19} aria-hidden="true" />
      </span>
      <span className="mt-1 font-display text-xl font-medium text-brand-ink">{title}</span>
      <span className="text-sm leading-relaxed text-brand-gray">{desc}</span>
      <span className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm text-brand-gray">
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
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray">Go deeper</p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-brand-ink">Four ways into the teaching</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tool
          style={i(0)}
          href={`/ask?q=${encodeURIComponent(STARTER_QUESTIONS[0])}`}
          icon={Sparkles}
          title="Ask the Word"
          desc="Any question, answered from Rev. Peter’s own words, with the moments to watch."
          foot={<span className="truncate italic">&ldquo;{STARTER_QUESTIONS[0]}&rdquo;</span>}
        />
        <Tool
          style={i(1)}
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
              <span className="pl-3">
                <b className="font-semibold tabular-nums text-brand-ink">{fmt(stats.series)}</b> series
              </span>
            </span>
          }
        />
        <Tool
          style={i(3)}
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
