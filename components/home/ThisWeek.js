"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { fetchTodaysDeclaration } from "@/lib/declarations";
import { cleanTitle, parseSermonDate, seriesName } from "@/lib/titles";

const longDate = (d) =>
  d ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : "";

const fmtRange = (start, end) => {
  if (!start) return "";
  const o = { month: "short", year: "numeric", timeZone: "UTC" };
  const s = new Date(start).toLocaleDateString("en-US", o);
  const e = end ? new Date(end).toLocaleDateString("en-US", o) : s;
  return s === e ? s : `${s} – ${e}`;
};

/** The newest service — by the date in its title (sermon_date is the upload date and lags). */
async function fetchLatestMessage() {
  const { data, error } = await supabase
    .from("sermons")
    .select("id, title, sermon_date, youtube_video_id, summary")
    .order("sermon_date", { ascending: false })
    .limit(12);
  if (error || !data?.length) return null;
  const dated = data.map((s) => ({ ...s, date: parseSermonDate(s.title) || (s.sermon_date ? new Date(s.sermon_date) : null) }));
  dated.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return dated[0];
}

async function fetchCurrentSeries() {
  const { data, error } = await supabase
    .from("series")
    .select("id, title, start_date, end_date, series_sermons ( part_number, sermons ( id, youtube_video_id ) )")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error || !data?.length) return null;
  const s = data[0];
  const parts = [...(s.series_sermons || [])].sort((a, b) => a.part_number - b.part_number);
  return {
    id: s.id,
    title: seriesName(s.title),
    parts: parts.length,
    range: fmtRange(s.start_date, s.end_date),
    firstPartId: parts[0]?.sermons?.id || null,
    covers: parts.map((p) => p.sermons?.youtube_video_id).filter(Boolean),
  };
}

function Skeleton() {
  return <div aria-hidden="true" className="min-h-[18rem] rounded-[1.75rem] bg-brand-sky motion-safe:animate-pulse" />;
}

/** Home: what's new — the latest message, today's declaration, the current series. */
export default function ThisWeek() {
  const [latest, setLatest] = useState(undefined);
  const [today, setToday] = useState(undefined);
  const [series, setSeries] = useState(undefined);

  useEffect(() => {
    let live = true;
    const settle = (p, set) => p.then((v) => live && set(v)).catch(() => live && set(null));
    settle(fetchLatestMessage(), setLatest);
    settle(fetchTodaysDeclaration(), setToday);
    settle(fetchCurrentSeries(), setSeries);
    return () => {
      live = false;
    };
  }, []);

  // Everything unavailable (e.g. the database is paused): hide the row entirely.
  if (latest === null && today === null && series === null) return null;

  return (
    <section aria-labelledby="week-heading" className="mx-auto max-w-[1400px] px-4 pt-14 sm:px-6 sm:pt-20">
      <h2 id="week-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink sm:text-4xl">
        This week
      </h2>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Latest message */}
        {latest === undefined ? (
          <Skeleton />
        ) : (
          latest && (
            <Link
              href={`/sermon/${latest.id}`}
              className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-brand-navy/10 bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0_30px_50px_-35px_rgba(23,58,104,0.5)]"
            >
              <span className="relative block aspect-video bg-brand-sky">
                <YtThumb ids={latest.youtube_video_id} className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-brand-deep/0 transition-colors group-hover:bg-brand-deep/20">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-brand-navy shadow-xl">
                    <Play size={20} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                  </span>
                </span>
              </span>
              <span className="flex flex-1 flex-col p-5">
                <span className="text-sm text-brand-gray">Latest message</span>
                <span className="mt-1.5 block font-display text-2xl font-medium leading-snug text-brand-ink">{cleanTitle(latest.title)}</span>
                {latest.date && <span className="mt-1 block text-sm text-brand-gray">{longDate(latest.date)}</span>}
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-navy">
                  Watch and study <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          )
        )}

        {/* Today's declaration */}
        {today === undefined ? (
          <Skeleton />
        ) : (
          today && (
            <div className="relative flex min-h-[18rem] flex-col items-center justify-center overflow-hidden rounded-[1.75rem] bg-black px-8 py-14 text-center text-white sm:px-10">
              <Image
                src="/declaration-bg-card.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover"
              />
              <p className="relative text-sm text-white/70">Today&rsquo;s declaration</p>
              {/* Verse-card size on mobile (text-base) — a declaration reads like
                  scripture, not like a headline. */}
              <blockquote className="relative mt-4 font-display text-base font-normal leading-relaxed text-balance sm:text-2xl sm:leading-snug">
                &ldquo;{today.declaration_text}&rdquo;
              </blockquote>
            </div>
          )
        )}

        {/* Current series */}
        {series === undefined ? (
          <Skeleton />
        ) : (
          series && (
            /* The cover carries its own lettering, so it gets its own frame
               rather than sitting behind our words — same shape as the latest
               message card beside it. */
            <Link
              href={`/series/${series.id}`}
              className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-brand-navy/10 bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0_30px_50px_-35px_rgba(23,58,104,0.5)]"
            >
              <span className="relative block aspect-video bg-brand-sky">
                <YtThumb ids={series.covers} className="h-full w-full object-cover" />
              </span>
              <span className="flex flex-1 flex-col p-5">
                <span className="text-sm text-brand-gray">Current series</span>
                <span className="mt-1.5 block font-display text-2xl font-medium leading-snug text-brand-ink">
                  {series.title}
                </span>
                <span className="mt-1 block text-sm text-brand-gray">
                  {series.parts} parts{series.range && ` · ${series.range}`}
                </span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-navy">
                  Study the series <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          )
        )}
      </div>
    </section>
  );
}
