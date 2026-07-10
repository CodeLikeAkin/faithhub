"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Quote,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanTitle } from "@/lib/titles";
import VerseExplorer from "@/components/VerseExplorer";
import WordStudy from "@/components/WordStudy";
import StudyChat from "@/components/StudyChat";
import ReactMarkdown from "react-markdown";

/**
 * Message page — editorial layout. The scripture data is the showpiece:
 * clean hero (real title, part position, one date, scripture count), the
 * grouped Verse Explorer as the main column, and a working right rail
 * (About / Declarations / Up next / Study this message).
 */

const DECL_PREVIEW = 3;

export default function SermonPage() {
  const { id } = useParams();
  const [sermon, setSermon] = useState(null);
  const [declarations, setDeclarations] = useState([]);
  const [series, setSeries] = useState(null); // { id, title, partNumber, totalParts }
  const [nextPart, setNextPart] = useState(null); // sermon row of part N+1
  const [scriptures, setScriptures] = useState(null); // null = loading
  const [notes, setNotes] = useState(null); // markdown from sermons.study_notes
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: s } = await supabase
          .from("sermons")
          .select(
            "id, title, sermon_date, youtube_video_id, youtube_url, summary, service_type"
          )
          .eq("id", id)
          .single();
        if (cancelled) return;
        setSermon(s || null);

        const [{ data: decls }, { data: link }, { data: refs }] =
          await Promise.all([
            supabase
              .from("declarations")
              .select("id, declaration_text, youtube_url_with_timestamp")
              .eq("sermon_id", id)
              .limit(12),
            supabase
              .from("series_sermons")
              .select("part_number, series ( id, title )")
              .eq("sermon_id", id)
              .maybeSingle(),
            supabase
              .from("sermon_scriptures")
              .select("*")
              .eq("sermon_id", id)
              .order("order_index", { ascending: true }),
          ]);
        if (cancelled) return;
        setDeclarations(decls || []);
        setScriptures(refs || []);

        // Separate, silent query — the study_notes column arrives with a
        // later migration; the page must not break before it exists.
        supabase
          .from("sermons")
          .select("study_notes")
          .eq("id", id)
          .single()
          .then(({ data: n, error }) => {
            if (!cancelled && !error && n?.study_notes) setNotes(n.study_notes);
          });

        if (link?.series) {
          // Sibling parts for "Part N of M" and the Up-next card.
          const { data: siblings } = await supabase
            .from("series_sermons")
            .select(
              "part_number, sermons ( id, title, sermon_date, youtube_video_id )"
            )
            .eq("series_id", link.series.id)
            .order("part_number", { ascending: true });
          if (cancelled) return;
          setSeries({
            id: link.series.id,
            title: link.series.title,
            partNumber: link.part_number,
            totalParts: siblings?.length || null,
          });
          const next = (siblings || []).find(
            (row) => row.part_number === link.part_number + 1
          );
          setNextPart(
            next ? { ...next.sermons, part_number: next.part_number } : null
          );
        }
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
        <Link
          href="/series"
          className="text-brand-navy font-bold hover:underline flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Series
        </Link>
      </div>
    );
  }

  const title = cleanTitle(sermon.title);
  const date = sermon.sermon_date
    ? new Date(sermon.sermon_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const scriptureCount = scriptures?.length || 0;
  const studyHref = series ? `/series/${series.id}` : null;
  const shownDecls = declarations.slice(0, DECL_PREVIEW);
  const moreDecls = declarations.length - shownDecls.length;

  return (
    <main className="min-h-screen bg-brand-light">
      {/* Hero — the artwork speaks for itself; text lives below it */}
      <section className="px-3 sm:px-5 pt-20 sm:pt-24">
        <div className="mx-auto max-w-[1060px]">
          <div className="relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden aspect-video bg-brand-deep">
            {sermon.youtube_video_id ? (
              <img
                src={`https://img.youtube.com/vi/${sermon.youtube_video_id}/maxresdefault.jpg`}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src="/church-hero.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <Link
              href={series ? `/series/${series.id}` : "/series"}
              className="absolute top-3 left-3 sm:top-4 sm:left-4 inline-flex items-center gap-2 bg-black/45 backdrop-blur-sm text-white text-xs font-bold rounded-full pl-3 pr-4 py-2 hover:bg-black/65 transition-colors"
            >
              <ArrowLeft size={13} />
              {series ? series.title : "All series"}
              {series?.partNumber && (
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-white/75">
                  Part {series.partNumber}
                  {series.totalParts ? ` of ${series.totalParts}` : ""}
                </span>
              )}
            </Link>
          </div>

          <div className="mt-5 sm:mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-1">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-4xl font-bold text-brand-ink leading-tight tracking-tight">
                {title}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-brand-gray">
                {sermon.service_type && (
                  <>
                    <span className="capitalize">{sermon.service_type}</span>
                    {" service · "}
                  </>
                )}
                {date && <span className="font-semibold text-brand-ink">{date}</span>}
                {scriptureCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-brand-ink">
                      {scriptureCount}
                    </span>{" "}
                    scriptures read
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {sermon.youtube_url && (
                <a
                  href={sermon.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-brand-navy text-white font-bold text-[13px] rounded-full px-5 py-3 hover:bg-brand-deep transition-colors"
                >
                  <Play size={13} fill="currentColor" />
                  Watch the message
                </a>
              )}
              <a
                href="#study"
                className="inline-flex items-center gap-2 border-[1.5px] border-brand-navy/25 text-brand-navy font-bold text-[13px] rounded-full px-5 py-3 hover:bg-brand-sky transition-colors"
              >
                <MessageSquare size={13} />
                Study this message
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-[1060px] px-4 sm:px-6 py-8 sm:py-10 grid lg:grid-cols-[minmax(0,1fr),320px] gap-6 lg:gap-8 items-start">
        <div className="space-y-6 min-w-0">
          {/* The Word — Verse Explorer (the showpiece) */}
          {scriptures === null ? (
            <div className="rounded-3xl border border-brand-navy/10 bg-white p-6 flex items-center gap-3 text-brand-gray">
              <Loader2 size={16} className="animate-spin text-brand-navy" />
              <span className="text-sm">Loading scriptures…</span>
            </div>
          ) : (
            <VerseExplorer sermonId={sermon.id} scriptures={scriptures} />
          )}

          {/* Notes from this message — a devoted member's notebook */}
          {notes && (
            <div className="rounded-3xl border border-brand-navy/10 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={17} />
                </span>
                <span>
                  <span className="block text-base font-bold text-brand-ink">
                    Notes from this message
                  </span>
                  <span className="block text-xs text-brand-gray">
                    As if you sat in the service with a notebook open
                  </span>
                </span>
              </div>
              <div className="text-[14.5px] leading-[1.75] text-brand-ink/90">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => (
                      <h3 className="text-brand-ink text-[15.5px] font-bold mt-5 mb-2 first:mt-0" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h3 className="text-brand-ink text-[15.5px] font-bold mt-5 mb-2 first:mt-0" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h4 className="text-brand-ink text-sm font-bold mt-4 mb-1.5 first:mt-0" {...props} />
                    ),
                    p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                    strong: ({ node, ...props }) => (
                      <strong className="text-brand-ink font-semibold" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc pl-5 space-y-1.5 my-3" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal pl-5 space-y-1.5 my-3" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="border-l-[3px] border-brand-navy/30 bg-brand-sky/40 rounded-r-lg pl-4 pr-3 py-2 my-3 italic text-brand-ink"
                        {...props}
                      />
                    ),
                  }}
                >
                  {notes}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Word Study — Greek/Hebrew explanations */}
          <WordStudy sermonId={sermon.id} />

          {/* Study this message — dedicated, scoped chat */}
          <div
            id="study"
            className="scroll-mt-24 rounded-3xl border border-brand-navy/10 bg-white overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-4 border-b border-brand-navy/10 bg-gradient-to-br from-brand-sky/50 to-white">
              <p className="text-base font-bold text-brand-ink">
                Study this message
              </p>
              <p className="text-xs text-brand-gray mt-0.5">
                A conversation grounded in this message alone
                {series?.partNumber ? ` — Part ${series.partNumber}` : ""}.
              </p>
            </div>
            <div className="h-[520px] flex flex-col min-h-0">
              <StudyChat
                seriesId={series?.id || null}
                sermonId={sermon.id}
                placeholder="Ask about this message…"
                hint="Answers come only from this message — every claim is cited."
                emptyNote="Ask anything about this message — the exact moments behind each answer come with it."
              />
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {sermon.summary && (
            <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-2.5">
                About this message
              </h2>
              <p className="text-[13.5px] text-brand-ink/90 leading-relaxed line-clamp-[8]">
                {sermon.summary}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-2.5 flex items-center gap-2">
              <Quote size={12} className="text-brand-navy" />
              Declarations from this message
            </h2>
            {shownDecls.length > 0 ? (
              <div className="space-y-4">
                {shownDecls.map((d) => (
                  <div key={d.id}>
                    <p className="text-[13.5px] italic text-brand-ink leading-relaxed">
                      &ldquo;{d.declaration_text}&rdquo;
                    </p>
                    {d.youtube_url_with_timestamp && (
                      <a
                        href={d.youtube_url_with_timestamp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-navy hover:underline"
                      >
                        <Play size={9} fill="currentColor" />
                        Watch moment
                      </a>
                    )}
                  </div>
                ))}
                {moreDecls > 0 && (
                  <p className="text-[11.5px] text-brand-gray">
                    + {moreDecls} more from this message
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-brand-gray leading-relaxed">
                Declarations from this message are being prepared.
              </p>
            )}
          </div>

          {nextPart && (
            <Link
              href={`/sermon/${nextPart.id}`}
              className="block rounded-2xl border border-brand-navy/10 bg-white p-5 hover:border-brand-navy/30 transition-colors group"
            >
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-3">
                Up next in this series
              </h2>
              <span className="flex items-center gap-3">
                <span className="relative w-[76px] aspect-video rounded-lg overflow-hidden bg-brand-sky flex-shrink-0">
                  {nextPart.youtube_video_id && (
                    <img
                      src={`https://img.youtube.com/vi/${nextPart.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-6 h-6 rounded-full bg-white/90 text-brand-navy flex items-center justify-center">
                      <Play size={9} fill="currentColor" className="translate-x-px" />
                    </span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-brand-ink leading-snug group-hover:text-brand-navy transition-colors">
                    Part {nextPart.part_number} · {cleanTitle(nextPart.title)}
                  </span>
                  {nextPart.sermon_date && (
                    <span className="block text-[11px] text-brand-gray mt-0.5">
                      {new Date(nextPart.sermon_date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          )}

          {studyHref && (
            <Link
              href={studyHref}
              className="flex items-center justify-between gap-3 rounded-2xl border border-brand-navy/10 bg-gradient-to-br from-brand-sky/70 to-white px-5 py-4 hover:border-brand-navy/40 transition-colors group"
            >
              <span>
                <span className="block text-[13px] font-bold text-brand-navy">
                  Study &ldquo;{series.title}&rdquo;
                </span>
                <span className="block text-[11.5px] text-brand-gray">
                  Ask questions across all{" "}
                  {series.totalParts ? `${series.totalParts} parts` : "parts"}
                </span>
              </span>
              <ArrowRight
                size={17}
                className="text-brand-navy flex-shrink-0 group-hover:translate-x-1 transition-transform"
              />
            </Link>
          )}
        </aside>
      </section>
    </main>
  );
}
