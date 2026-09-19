"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseYoutubeUrl } from "@/lib/youtube";
import VideoModal from "@/components/VideoModal";

/**
 * Declaration of the Day — picks one declaration deterministically per day
 * (day-of-year modulo a stable, ordered sample). Hides itself entirely if
 * the database is unreachable (e.g. free-tier Supabase paused).
 */
export default function DeclarationOfTheDay() {
  const [decl, setDecl] = useState(null);
  const [watching, setWatching] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let { data, error } = await supabase
          .from("declarations")
          .select("id, declaration_text, youtube_url_with_timestamp, sermons ( title )")
          .order("id")
          .limit(100);

        if (error) {
          // Relation join can fail if FK metadata differs — retry flat
          ({ data, error } = await supabase
            .from("declarations")
            .select("id, declaration_text, youtube_url_with_timestamp")
            .order("id")
            .limit(100));
        }

        if (error || !data?.length || cancelled) return;

        const now = new Date();
        const dayOfYear = Math.floor(
          (now - new Date(now.getFullYear(), 0, 0)) / 86400000
        );
        setDecl(data[dayOfYear % data.length]);
      } catch {
        // stay hidden
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!decl) return null;

  const parsed = parseYoutubeUrl(decl.youtube_url_with_timestamp);

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-14 sm:pt-20">
      <div className="relative isolate overflow-clip rounded-[2rem] bg-brand-sky border border-brand-navy/10 px-6 sm:px-12 py-10 sm:py-14 text-center">
        {/* Decoration stays at the edges and under the content (-z-10). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-white/80 blur-3xl" />
          <div className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-brand-mist/70 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(23,58,104,0.16)_1px,transparent_1.5px)] bg-[length:22px_22px] [mask-image:radial-gradient(ellipse_at_center,transparent_45%,black_95%)]" />
          <svg
            viewBox="0 0 400 400"
            fill="none"
            className="absolute -right-32 -top-32 hidden h-[26rem] w-[26rem] text-brand-navy/[0.09] sm:block"
          >
            {[70, 115, 160, 205, 250, 295].map((r) => (
              <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="1.25" />
            ))}
          </svg>
          <svg
            viewBox="0 0 400 400"
            fill="none"
            className="absolute -bottom-40 -left-40 hidden h-[24rem] w-[24rem] text-brand-navy/[0.07] sm:block"
          >
            {[80, 130, 180, 230, 280].map((r) => (
              <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="1.25" />
            ))}
          </svg>
          <span className="absolute left-6 top-0 hidden select-none font-display text-[11rem] leading-none text-brand-navy/[0.07] sm:block lg:left-14">
            &ldquo;
          </span>
          <span className="absolute bottom-[-7rem] right-4 hidden select-none font-display text-[11rem] leading-none text-brand-navy/[0.07] sm:block lg:right-8">
            &rdquo;
          </span>
        </div>

        <p className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-brand-navy">
          <span aria-hidden="true" className="hidden h-px w-8 bg-brand-navy/30 sm:block" />
          Declaration of the day
          <span aria-hidden="true" className="hidden h-px w-8 bg-brand-navy/30 sm:block" />
        </p>
        <blockquote className="mt-5 mx-auto max-w-3xl text-xl sm:text-3xl font-medium leading-snug text-brand-ink">
          &ldquo;{decl.declaration_text}&rdquo;
        </blockquote>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
          {decl.sermons?.title && (
            <p className="text-xs sm:text-sm text-brand-gray">
              From &ldquo;{decl.sermons.title}&rdquo;
            </p>
          )}
          {parsed && (
            <button
              type="button"
              onClick={() =>
                setWatching({ ...parsed, sermon_title: decl.sermons?.title })
              }
              className="inline-flex items-center gap-2 bg-brand-navy text-white text-xs sm:text-sm font-bold rounded-full px-5 py-2.5 hover:bg-brand-deep transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Watch Pastor speak it
            </button>
          )}
        </div>
      </div>
      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </section>
  );
}
