"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { readLastLesson } from "@/lib/recent";
import { displayTitle, seriesName } from "@/lib/titles";
import { cn } from "@/lib/utils";
import ThumbFallback from "./ThumbFallback";

async function fetchLatestSeries() {
  const { data, error } = await supabase
    .from("series")
    .select("id, title, series_sermons ( part_number, sermons ( id, youtube_video_id ) )")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error || !data?.length) return null;
  const s = data[0];
  const parts = [...(s.series_sermons || [])].sort((a, b) => a.part_number - b.part_number);
  return {
    kind: "new-series",
    href: `/series/${s.id}`,
    title: seriesName(s.title),
    parts: parts.length,
    videoIds: parts.map((p) => p.sermons?.youtube_video_id).filter(Boolean),
  };
}

/**
 * Home: the lesson the reader last opened (device-local), or — on a first
 * visit — the newest series to start with.
 */
export default function ContinueCard({ className, style }) {
  const [item, setItem] = useState(undefined);

  useEffect(() => {
    const last = readLastLesson();
    if (last) {
      setItem(last);
      return;
    }
    let live = true;
    fetchLatestSeries()
      .then((s) => live && setItem(s))
      .catch(() => live && setItem(null));
    return () => {
      live = false;
    };
  }, []);

  if (item === null) return null;

  const eyebrow = !item
    ? ""
    : item.kind === "new-series"
    ? "Start the latest series"
    : "Continue studying";
  const meta = !item
    ? ""
    : item.kind === "lesson" && item.partNumber && item.seriesTitle
    ? `Part ${item.partNumber} of ${item.parts} · ${displayTitle(item.seriesTitle)}`
    : item.parts
    ? `${item.parts} parts`
    : "Message";
  const progress = item?.kind === "lesson" && item.partNumber && item.parts ? item.partNumber / item.parts : null;

  return (
    <article
      style={style}
      className={cn("flex flex-col gap-4 rounded-[1.75rem] border border-brand-navy/10 bg-white p-4 sm:p-5", className)}
    >
      <p className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-gray">{eyebrow || " "}</p>
      {item === undefined ? (
        <div aria-hidden="true" className="aspect-video rounded-2xl bg-brand-sky motion-safe:animate-pulse" />
      ) : (
        <Link href={item.href} className="group flex flex-1 flex-col gap-3">
          <span className="relative block aspect-video overflow-hidden rounded-2xl bg-brand-deep">
            <YtThumb
              ids={item.videoIds || item.videoId}
              quality={["maxresdefault", "hq720", "mqdefault"]}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              fallback={<ThumbFallback title={displayTitle(item.title)} />}
            />
            <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white text-brand-navy shadow-lg">
              <Play size={16} fill="currentColor" className="translate-x-px" aria-hidden="true" />
            </span>
          </span>
          <span className="px-1">
            <span className="line-clamp-2 font-display text-xl font-medium leading-snug text-brand-ink">{displayTitle(item.title)}</span>
            <span className="mt-1 block text-sm text-brand-gray">{meta}</span>
          </span>
          <span className="mt-auto flex items-center gap-3 px-1">
            {progress != null && (
              <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-sky">
                <span className="block h-full rounded-full bg-brand-navy" style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-navy">
              {item.kind === "new-series" ? "Start" : "Resume"}
              <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </Link>
      )}
    </article>
  );
}
