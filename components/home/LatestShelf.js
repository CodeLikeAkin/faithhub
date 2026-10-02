"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { parseSermonDate, parseTitle, seriesName } from "@/lib/titles";
import Shelf from "./Shelf";
import ThumbFallback from "./ThumbFallback";

const shortDate = (d) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

/**
 * The newest uploads, newest first (`sermon_date` is the YouTube upload
 * date). Deliberately includes messages outside any series, like the old
 * "Latest message" card did.
 */
async function fetchLatest(limit = 12) {
  const { data, error } = await supabase
    .from("sermons")
    .select("id, title, sermon_date, youtube_video_id, series_sermons ( part_number, series ( title ) )")
    .not("youtube_video_id", "is", null)
    .order("sermon_date", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((s) => {
    const link = s.series_sermons?.[0];
    const series = link?.series?.title ? seriesName(link.series.title) : null;
    const t = parseTitle(s.title, link?.series?.title);
    return {
      id: s.id,
      videoId: s.youtube_video_id,
      name: t.name,
      speaker: t.speaker || "Rev. Peter Alabi",
      badge: link?.part_number ? `Part ${link.part_number}` : t.session,
      series,
      date: parseSermonDate(s.title) || (s.sermon_date ? new Date(s.sermon_date) : null),
    };
  });
}

export default function LatestShelf({ style }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let live = true;
    fetchLatest()
      .then((v) => live && setItems(v))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);

  if (items && !items.length) return null;

  return (
    <div style={style} className="fh-rise rounded-[1.75rem] border border-brand-navy/10 bg-white p-5 shadow-card sm:p-6">
      <Shelf
        eyebrow="Just posted"
        title="Latest messages"
        action={
          <Link href="/series" className="group hidden items-center gap-1 text-sm font-semibold text-brand-navy sm:inline-flex">
            All series <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      >
        {items === null
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} aria-hidden="true" className="snap-start">
                <div className="aspect-video rounded-xl fh-skeleton" />
                <div className="mt-3 h-4 w-4/5 rounded-full fh-skeleton" />
              </div>
            ))
          : items.map((m, i) => (
              <Link
                key={m.id}
                href={`/sermon/${m.id}`}
                style={{ "--i": i }}
                className="fh-rise group flex min-w-0 snap-start flex-col gap-2.5"
              >
                <span className="relative block aspect-video overflow-hidden rounded-xl bg-brand-deep">
                  <YtThumb
                    ids={m.videoId}
                    quality={["hq720", "mqdefault"]}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    fallback={<ThumbFallback title={m.name} subtitle={m.speaker} />}
                  />
                  {m.badge && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-brand-deep/80 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {m.badge}
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 grid h-9 w-9 translate-y-1.5 place-items-center rounded-full bg-white text-brand-navy opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    <Play size={14} fill="currentColor" className="translate-x-px" aria-hidden="true" />
                  </span>
                </span>
                <span className="min-w-0 px-0.5">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-brand-ink group-hover:text-brand-navy">{m.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-brand-gray">
                    {m.speaker}
                    {m.date ? ` · ${shortDate(m.date)}` : ""}
                  </span>
                </span>
              </Link>
            ))}
      </Shelf>
    </div>
  );
}
