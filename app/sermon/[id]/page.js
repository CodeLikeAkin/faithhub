"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Calendar,
  Quote,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import VerseExplorer from "@/components/VerseExplorer";
import WordStudy from "@/components/WordStudy";

export default function SermonPage() {
  const { id } = useParams();
  const [sermon, setSermon] = useState(null);
  const [declarations, setDeclarations] = useState([]);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: s } = await supabase
          .from("sermons")
          .select("id, title, sermon_date, youtube_video_id, youtube_url, summary, service_type")
          .eq("id", id)
          .single();
        if (cancelled) return;
        setSermon(s || null);

        const [{ data: decls }, { data: link }] = await Promise.all([
          supabase
            .from("declarations")
            .select("id, declaration_text, youtube_url_with_timestamp")
            .eq("sermon_id", id)
            .limit(12),
          supabase
            .from("series_sermons")
            .select("series ( id, title )")
            .eq("sermon_id", id)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setDeclarations(decls || []);
        setSeries(link?.series || null);
      } catch (err) {
        console.error("Error loading sermon:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-navy animate-spin" />
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink mb-4">Sermon not found</h1>
        <Link href="/series" className="text-brand-navy font-bold hover:underline flex items-center gap-2">
          <ArrowLeft size={18} /> Back to Series
        </Link>
      </div>
    );
  }

  const date = sermon.sermon_date
    ? new Date(sermon.sermon_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="px-3 sm:px-5 pt-3 sm:pt-5">
        <div className="relative mx-auto max-w-[1000px] rounded-[1.75rem] sm:rounded-[2.5rem] overflow-hidden min-h-[360px] flex flex-col justify-end">
          {sermon.youtube_video_id ? (
            <img
              src={`https://img.youtube.com/vi/${sermon.youtube_video_id}/maxresdefault.jpg`}
              alt={sermon.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src="/church-hero.jpg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/90 via-brand-deep/40 to-brand-deep/20" />

          <div className="relative z-10 p-6 sm:p-10">
            <Link
              href={series ? `/series/${series.id}` : "/series"}
              className="inline-flex items-center gap-2 text-xs font-bold text-white/80 hover:text-white mb-4"
            >
              <ArrowLeft size={14} />
              {series ? series.title : "Back to Series"}
            </Link>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {sermon.service_type && (
                <span className="px-2.5 py-1 bg-white/95 text-brand-navy rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {sermon.service_type}
                </span>
              )}
              {date && (
                <span className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                  <Calendar size={13} />
                  {date}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight max-w-3xl">
              {sermon.title}
            </h1>
            {sermon.youtube_url && (
              <a
                href={sermon.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 bg-white text-brand-navy font-bold text-sm rounded-full px-6 py-3.5 hover:bg-brand-sky transition-colors"
              >
                <Play size={15} fill="currentColor" />
                Watch the message
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-[1000px] px-4 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[1fr,340px] gap-8 lg:gap-12">
        <div className="space-y-8">
          {sermon.summary && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy mb-3">
                About this message
              </h2>
              <p className="text-brand-ink leading-relaxed">{sermon.summary}</p>
            </div>
          )}

          {/* The Word — Verse Explorer */}
          <VerseExplorer sermonId={sermon.id} />

          {/* Word Study — Greek/Hebrew explanations */}
          <WordStudy sermonId={sermon.id} />

          {/* Study CTA */}
          {series && (
            <Link
              href={`/series/${series.id}`}
              className="flex items-center justify-between gap-4 rounded-3xl border border-brand-navy/10 bg-brand-sky/50 px-5 sm:px-6 py-5 hover:bg-brand-sky transition-colors group"
            >
              <span className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-brand-navy text-white flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4.5 h-4.5" size={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-brand-ink">
                    Study &ldquo;{series.title}&rdquo;
                  </span>
                  <span className="block text-xs text-brand-gray">
                    Ask questions across this whole series
                  </span>
                </span>
              </span>
              <ArrowLeft className="w-5 h-5 text-brand-navy rotate-180 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Declarations rail */}
        <aside className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray flex items-center gap-2">
            <Quote size={13} className="text-brand-navy" />
            Declarations from this message
          </h2>
          {declarations.length > 0 ? (
            declarations.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-brand-navy/10 bg-white p-4"
              >
                <p className="text-sm italic text-brand-ink leading-relaxed mb-3">
                  &ldquo;{d.declaration_text}&rdquo;
                </p>
                {d.youtube_url_with_timestamp && (
                  <a
                    href={d.youtube_url_with_timestamp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-navy hover:underline"
                  >
                    <Play size={9} fill="currentColor" />
                    Watch moment
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-brand-gray">
              No declarations extracted for this message yet.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
