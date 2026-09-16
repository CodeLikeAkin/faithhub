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
      <div className="rounded-[2rem] bg-brand-sky border border-brand-navy/10 px-6 sm:px-12 py-10 sm:py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-navy">
          Declaration of the day
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
