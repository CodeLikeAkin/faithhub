"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Play, Loader2, Quote } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanTitle } from "@/lib/titles";
import { fetchPassage } from "@/lib/bible";
import StudyChat from "@/components/StudyChat";

/**
 * Series studio — three zones, same grammar as Ask the Word.
 * Left: the parts timeline (one row per part; click opens that message's own
 * page with its verses, notes and declarations — hover for Watch). Center:
 * the study thread (StudyChat), always grounded in the WHOLE series. Right
 * (wide screens): "Series at a glance" — the key verses of the series
 * (tap to read) and key declarations.
 */

// ─────────────────────────────────────────────────────────
// KeyVerses — the series' most-read verses, tap to read
// ─────────────────────────────────────────────────────────
const KeyVerses = ({ verses }) => {
  const [openRef, setOpenRef] = useState(null);
  const [texts, setTexts] = useState({}); // reference -> {loading}|{verses,translation}|{error}

  const toggle = async (v) => {
    if (openRef === v.reference) {
      setOpenRef(null);
      return;
    }
    setOpenRef(v.reference);
    if (texts[v.reference]) return;
    setTexts((t) => ({ ...t, [v.reference]: { loading: true } }));
    const passage = await fetchPassage({
      book: v.book,
      bookId: v.book_id,
      chapter: v.chapter,
      verseStart: v.verse_start,
      verseEnd: v.verse_end,
    });
    setTexts((t) => ({
      ...t,
      [v.reference]: passage
        ? { verses: passage.verses, translation: passage.translation }
        : { error: true },
    }));
  };

  const open = verses.find((v) => v.reference === openRef);
  const vt = open ? texts[open.reference] : null;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {verses.map((v) => (
          <button
            key={v.reference}
            onClick={() => toggle(v)}
            aria-expanded={openRef === v.reference}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
              openRef === v.reference
                ? "bg-brand-navy text-white border-brand-navy"
                : "bg-brand-sky text-brand-navy border-brand-navy/10 hover:border-brand-navy/40"
            }`}
          >
            {v.reference}
            {v.count > 1 && (
              <span
                className={`text-[10px] font-semibold ${
                  openRef === v.reference ? "text-white/70" : "text-brand-navy/50"
                }`}
              >
                ×{v.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-2.5 rounded-r-xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-white px-3.5 py-3">
          {vt?.loading && (
            <span className="flex items-center gap-2 text-xs text-brand-gray">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading verse…
            </span>
          )}
          {vt?.error && (
            <p className="text-xs text-brand-gray italic">
              Couldn&apos;t load this verse right now.
            </p>
          )}
          {vt?.verses && (
            <p className="text-[13px] leading-relaxed text-brand-ink">
              {vt.verses.map((v) => (
                <span key={v.number}>
                  <sup className="text-brand-navy/50 font-bold mr-0.5">{v.number}</sup>
                  {v.text}{" "}
                </span>
              ))}
              <span className="block mt-1 text-[10px] uppercase tracking-wider text-brand-gray">
                {open.reference} · {vt.translation}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────
export default function SeriesDetailPage() {
  const { id } = useParams();
  const [series, setSeries] = useState(null);
  const [sermons, setSermons] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [scriptureStats, setScriptureStats] = useState(null); // { total, top: [...] }
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySuggestions, setSummarySuggestions] = useState([]);

  useEffect(() => {
    if (id) fetchSeriesData();
  }, [id]);

  useEffect(() => {
    if (series && sermons.length > 0) generateSeriesSummary();
  }, [series, sermons]);

  const fetchSeriesData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("series")
        .select(
          `
          *,
          series_sermons (
            part_number,
            sermons (
              id, title, sermon_date, youtube_video_id, youtube_url, transcript, summary
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setSeries(data);
        const sortedSermons = data.series_sermons
          .sort((a, b) => a.part_number - b.part_number)
          .map((ss) => ({ ...ss.sermons, part_number: ss.part_number }));
        setSermons(sortedSermons);

        const sermonIds = sortedSermons.map((s) => s.id);
        const wantRefs = !Array.isArray(data.key_verses) || !data.key_verses.length;
        const [{ data: decls }, refsRes] = await Promise.all([
          supabase
            .from("declarations")
            .select("id, declaration_text, youtube_url_with_timestamp")
            .in("sermon_id", sermonIds)
            .limit(50),
          // Stored key verses win; only aggregate live when absent.
          wantRefs
            ? supabase
                .from("sermon_scriptures")
                .select("reference, book, book_id, chapter, verse_start, verse_end")
                .in("sermon_id", sermonIds)
            : Promise.resolve({ data: null }),
        ]);
        setDeclarations(decls || []);

        if (!wantRefs) {
          setScriptureStats({
            total: data.key_verses_total ?? null,
            top: data.key_verses,
          });
        } else if (refsRes.data?.length) {
          // Key verses = the exact references read most often across the series.
          const counts = new Map();
          for (const r of refsRes.data) {
            const cur = counts.get(r.reference);
            if (cur) cur.count += 1;
            else counts.set(r.reference, { ...r, count: 1 });
          }
          const top = [...counts.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
          setScriptureStats({ total: refsRes.data.length, top });
        } else {
          setScriptureStats({ total: 0, top: [] });
        }
      }
    } catch (err) {
      console.error("Error fetching series details:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateSeriesSummary = async () => {
    if (summary) return;
    // Stored summary → zero tokens. The API generates + saves only when missing.
    if (series.study_summary) {
      setSummary(series.study_summary);
      if (Array.isArray(series.suggested_questions))
        setSummarySuggestions(series.suggested_questions);
      return;
    }
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/series-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: id,
          title: series.title,
          sermonTitles: sermons.map((s) => s.title),
        }),
      });
      const data = await res.json();
      setSummary(data.summary);
      if (data.suggestions) setSummarySuggestions(data.suggestions);
    } catch (err) {
      console.error("Error generating summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatDateRange = (start, end) => {
    if (!start) return "";
    const options = { month: "short", year: "numeric" };
    const s = new Date(start).toLocaleDateString("en-US", options);
    const e = end ? new Date(end).toLocaleDateString("en-US", options) : s;
    return s === e ? s : `${s} – ${e}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-navy animate-spin" />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-brand-light flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink mb-4">Series not found</h1>
        <Link
          href="/series"
          className="text-brand-navy font-bold hover:underline flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Browse
        </Link>
      </div>
    );
  }

  const shownDecls = declarations.slice(0, 3);

  return (
    <main className="h-dvh bg-white text-brand-ink flex flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      {/* ── Zone 1 · Parts timeline ────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col min-h-0 bg-brand-light border-r border-brand-navy/10">
        <div className="px-5 pt-5 pb-3">
          <Link
            href="/series"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-gray hover:text-brand-navy transition-colors"
          >
            <ArrowLeft size={13} /> All series
          </Link>
          <h2 className="mt-3 text-xl font-bold text-brand-ink leading-tight">
            {series.title}
          </h2>
          <p className="mt-1 text-[11.5px] text-brand-gray">
            {sermons.length} {sermons.length === 1 ? "part" : "parts"} ·{" "}
            {formatDateRange(series.start_date, series.end_date)}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-3">
          <ul className="flex flex-col gap-0.5">
            {sermons.map((sermon) => (
              <li key={sermon.id}>
                <Link
                  href={`/sermon/${sermon.id}`}
                  className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 hover:bg-brand-sky/70 transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg text-[11.5px] font-bold flex items-center justify-center flex-shrink-0 bg-brand-sky text-brand-navy group-hover:bg-brand-navy group-hover:text-white transition-colors">
                    {sermon.part_number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-brand-ink leading-snug">
                      Part {sermon.part_number}
                    </span>
                    <span className="block text-[11px] text-brand-gray mt-0.5 line-clamp-1">
                      {cleanTitle(sermon.title)}
                      {sermon.sermon_date &&
                        ` · ${new Date(sermon.sermon_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}`}
                    </span>
                  </span>
                  <span className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {sermon.youtube_url && (
                      <a
                        href={sermon.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Watch"
                        className="w-6 h-6 rounded-md border border-brand-navy/15 bg-white text-brand-navy flex items-center justify-center hover:bg-brand-sky"
                      >
                        <Play size={9} fill="currentColor" />
                      </a>
                    )}
                    <ArrowUpRight size={13} className="text-brand-navy/50 self-center" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 py-3.5 border-t border-brand-navy/10">
          <p className="text-[11px] text-brand-gray leading-relaxed">
            Open a part to read its verses, notes and declarations, and to
            study that message on its own.
          </p>
        </div>
      </aside>

      {/* ── Zone 2 · Study thread ──────────────────────────────────────────── */}
      <section className="flex flex-col min-h-0 min-w-0 flex-1">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-brand-navy/10 bg-gradient-to-br from-brand-sky/50 to-white px-4 sm:px-7 pt-4 pb-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/series" className="lg:hidden text-brand-gray hover:text-brand-navy">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-ink">
              {series.title}
            </h1>
            <span className="px-2.5 py-1 bg-brand-navy/10 border border-brand-navy/15 text-brand-navy rounded-full text-[9.5px] font-bold uppercase tracking-wider">
              Grounded in all {sermons.length} parts
            </span>
          </div>
          <div className="mt-1.5 text-[13px] text-brand-gray leading-relaxed max-w-2xl">
            {summaryLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-brand-navy" />
                Reading the series…
              </span>
            ) : (
              <p className="line-clamp-2">
                {summary || "Ask anything — every answer is grounded in these messages."}
              </p>
            )}
          </div>

          {/* Mobile part chips — open the message page */}
          <div className="lg:hidden mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sermons.map((sermon) => (
              <Link
                key={sermon.id}
                href={`/sermon/${sermon.id}`}
                className="flex-shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold bg-white text-brand-navy border-brand-navy/15 hover:bg-brand-sky transition-colors"
              >
                Part {sermon.part_number}
              </Link>
            ))}
          </div>
        </div>

        <StudyChat
          seriesId={id}
          openers={summarySuggestions}
          placeholder="Ask about this series…"
          hint={`Answers come only from these ${sermons.length} messages — every claim is cited.`}
          emptyNote="Ask anything about this series — the exact moments behind each answer come with it."
        />
      </section>

      {/* ── Zone 3 · Series at a glance ────────────────────────────────────── */}
      <aside className="hidden xl:flex flex-col min-h-0 bg-brand-light border-l border-brand-navy/10 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gray px-1">
            Series at a glance
          </p>

          <div className="flex gap-2.5">
            {[
              [sermons.length, sermons.length === 1 ? "part" : "parts"],
              [scriptureStats?.total ?? "–", "scriptures"],
              [declarations.length, "declarations"],
            ].map(([n, label]) => (
              <div
                key={label}
                className="flex-1 rounded-xl border border-brand-navy/10 bg-white py-2.5 text-center"
              >
                <p className="text-lg font-bold text-brand-ink tabular-nums leading-tight">
                  {n}
                </p>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-gray">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {scriptureStats?.top?.length > 0 && (
            <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-1">
                Key verses in this series
              </h3>
              <p className="text-[10.5px] text-brand-gray mb-3">
                The verses Rev. Peter returned to most — tap to read.
              </p>
              <KeyVerses verses={scriptureStats.top} />
              <Link
                href="/word"
                className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-navy hover:underline"
              >
                See all in The Word <ArrowUpRight size={11} />
              </Link>
            </div>
          )}

          <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-3 flex items-center gap-1.5">
              <Quote size={11} className="text-brand-navy" />
              Key declarations
            </h3>
            {shownDecls.length > 0 ? (
              <div className="space-y-4">
                {shownDecls.map((decl) => (
                  <div key={decl.id}>
                    <p className="text-[12.5px] italic text-brand-ink leading-relaxed">
                      &ldquo;{decl.declaration_text}&rdquo;
                    </p>
                    {decl.youtube_url_with_timestamp && (
                      <a
                        href={decl.youtube_url_with_timestamp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-brand-navy hover:underline"
                      >
                        <Play size={8} fill="currentColor" />
                        Watch moment
                      </a>
                    )}
                  </div>
                ))}
                {declarations.length > 3 && (
                  <p className="text-[11px] text-brand-gray">
                    + {declarations.length - 3} more across the series
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11.5px] text-brand-gray leading-relaxed">
                Declarations from this series are being prepared.
              </p>
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}
