"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Play,
  Quote,
  Loader2,
  Layers,
  MessageSquare,
  BookOpen,
  Languages,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanTitle } from "@/lib/titles";
import { fetchPassage, TRANSLATIONS } from "@/lib/bible";
import { parseYoutubeUrl } from "@/lib/youtube";
import StudyChat from "@/components/StudyChat";
import VerseExplorer from "@/components/VerseExplorer";
import WordStudy from "@/components/WordStudy";
import VideoModal from "@/components/VideoModal";
import ThemeToggle from "@/components/ThemeToggle";
import ReactMarkdown from "react-markdown";

/**
 * StudyWorkspace — one shell, two lenses. The series studio and the single
 * message page are the same three-zone layout differing only in SCOPE, so
 * this component renders both and a toggle flips between them live (no page
 * reload). `/series/[id]` boots it in "series" mode; `/sermon/[id]` boots it
 * in "message" mode on that part. Flipping the lens rewrites the URL with
 * history.replaceState so the address bar always reflects what you're seeing
 * and every link stays shareable / reloadable.
 *
 * Props (exactly one entry point):
 *   entry = { type: "series", seriesId } | { type: "sermon", sermonId }
 */

const DECL_PREVIEW = 3;

// ─────────────────────────────────────────────────────────
// KeyVerses — the series' most-read verses, tap to read (series lens)
// ─────────────────────────────────────────────────────────
const KeyVerses = ({ verses }) => {
  const [openRef, setOpenRef] = useState(null);
  const [texts, setTexts] = useState({}); // reference -> { KJV?, NLT?: {loading}|{verses,translation}|{error} }
  const [shownTranslation, setShownTranslation] = useState({}); // reference -> "KJV" | "NLT"

  const loadText = async (v, translation) => {
    setTexts((t) => ({
      ...t,
      [v.reference]: { ...t[v.reference], [translation]: { loading: true } },
    }));
    const passage = await fetchPassage(
      {
        book: v.book,
        bookId: v.book_id,
        chapter: v.chapter,
        verseStart: v.verse_start,
        verseEnd: v.verse_end,
      },
      translation
    );
    setTexts((t) => ({
      ...t,
      [v.reference]: {
        ...t[v.reference],
        [translation]: passage
          ? { verses: passage.verses, translation: passage.translation }
          : { error: true },
      },
    }));
  };

  const toggle = (v) => {
    if (openRef === v.reference) {
      setOpenRef(null);
      return;
    }
    setOpenRef(v.reference);
    const t = shownTranslation[v.reference] || "KJV";
    if (!texts[v.reference]?.[t]) loadText(v, t);
  };

  const switchTranslation = (v, translation) => {
    setShownTranslation((st) => ({ ...st, [v.reference]: translation }));
    if (!texts[v.reference]?.[translation]) loadText(v, translation);
  };

  const open = verses.find((v) => v.reference === openRef);
  const t = open ? shownTranslation[open.reference] || "KJV" : "KJV";
  const vt = open ? texts[open.reference]?.[t] : null;

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
        <div className="mt-2.5 rounded-r-xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-card px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-brand-navy">{open.reference}</span>
            <span className="flex rounded-full border border-brand-navy/15 p-0.5 flex-shrink-0">
              {TRANSLATIONS.map((tr) => (
                <button
                  key={tr}
                  onClick={() => switchTranslation(open, tr)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    t === tr
                      ? "bg-brand-navy text-white"
                      : "text-brand-gray hover:text-brand-navy"
                  }`}
                >
                  {tr}
                </button>
              ))}
            </span>
          </div>
          {vt?.loading && (
            <span className="mt-1.5 flex items-center gap-2 text-xs text-brand-gray">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading verse…
            </span>
          )}
          {vt?.error && (
            <p className="mt-1.5 text-xs text-brand-gray italic">
              Couldn&apos;t load this verse right now.
            </p>
          )}
          {vt?.verses && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-ink">
              {vt.verses.map((v) => (
                <span key={v.number}>
                  <sup className="text-brand-navy/50 font-bold mr-0.5">{v.number}</sup>
                  {v.text}{" "}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────
export default function StudyWorkspace({ entry }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [series, setSeries] = useState(null); // null in solo (no-series) mode
  const [parts, setParts] = useState([]); // sorted sermons of the series
  const [seriesDecls, setSeriesDecls] = useState([]);
  const [scriptureStats, setScriptureStats] = useState(null); // { total, top }
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySuggestions, setSummarySuggestions] = useState([]);

  const [mode, setMode] = useState("series"); // "series" | "message"
  const [activePartId, setActivePartId] = useState(null);
  const [partData, setPartData] = useState({}); // sermonId -> { loading, scriptures, wordStudies, declarations, notes }
  const [activeTab, setActiveTab] = useState("study");
  const [showAllDecls, setShowAllDecls] = useState(false);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal
  const loadedParts = useRef(new Set()); // sermonIds whose data is loaded / in-flight

  const hasSeries = !!series;

  // ── boot: resolve the entry point into a full bundle ──────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        let seriesId = entry.type === "series" ? entry.seriesId : null;
        const entrySermonId = entry.type === "sermon" ? entry.sermonId : null;

        // From a sermon, find its series (if any).
        if (entry.type === "sermon") {
          const { data: link } = await supabase
            .from("series_sermons")
            .select("part_number, series ( id, title )")
            .eq("sermon_id", entrySermonId)
            .maybeSingle();

          if (link?.series) {
            seriesId = link.series.id;
          } else {
            // Solo message — no series to broaden into.
            const { data: s } = await supabase
              .from("sermons")
              .select(
                "id, title, sermon_date, youtube_video_id, youtube_url, summary, service_type"
              )
              .eq("id", entrySermonId)
              .single();
            if (cancelled) return;
            if (!s) {
              setNotFound(true);
              return;
            }
            setSeries(null);
            setParts([{ ...s, part_number: null }]);
            setActivePartId(s.id);
            setMode("message");
            setActiveTab("study");
            loadPartData(s.id);
            return;
          }
        }

        // Load the series bundle.
        const { data } = await supabase
          .from("series")
          .select(
            `*, series_sermons ( part_number, sermons ( id, title, sermon_date, youtube_video_id, youtube_url, summary, service_type ) )`
          )
          .eq("id", seriesId)
          .single();
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          return;
        }

        setSeries(data);
        const sorted = data.series_sermons
          .sort((a, b) => a.part_number - b.part_number)
          .map((ss) => ({ ...ss.sermons, part_number: ss.part_number }));
        setParts(sorted);

        // Series-level declarations + scripture stats (same rules as before:
        // stored key verses win; only aggregate live when they're absent).
        const sermonIds = sorted.map((s) => s.id);
        const wantRefs = !Array.isArray(data.key_verses) || !data.key_verses.length;
        const [{ data: decls }, refsRes] = await Promise.all([
          supabase
            .from("declarations")
            .select("id, declaration_text, youtube_url_with_timestamp")
            .in("sermon_id", sermonIds)
            .limit(50),
          wantRefs
            ? supabase
                .from("sermon_scriptures")
                .select("reference, book, book_id, chapter, verse_start, verse_end")
                .in("sermon_id", sermonIds)
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        setSeriesDecls(decls || []);

        if (!wantRefs) {
          setScriptureStats({ total: data.key_verses_total ?? null, top: data.key_verses });
        } else if (refsRes.data?.length) {
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

        // Set the opening lens.
        if (entry.type === "sermon") {
          setMode("message");
          setActivePartId(entrySermonId);
          setActiveTab("study");
          loadPartData(entrySermonId);
        } else {
          setMode("series");
          setActiveTab("study");
        }
      } catch (err) {
        console.error("StudyWorkspace boot error:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.type, entry.seriesId, entry.sermonId]);

  // Series summary + openers (series lens) — stored value costs zero tokens.
  useEffect(() => {
    if (!series || parts.length === 0 || summary) return;
    if (series.study_summary) {
      setSummary(series.study_summary);
      if (Array.isArray(series.suggested_questions))
        setSummarySuggestions(series.suggested_questions);
      return;
    }
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch("/api/series-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesId: series.id,
            title: series.title,
            sermonTitles: parts.map((s) => s.title),
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        setSummary(data.summary || "");
        if (data.suggestions) setSummarySuggestions(data.suggestions);
      } catch (err) {
        console.error("Series summary error:", err);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [series, parts, summary]);

  // ── per-part message data, loaded on demand and cached ────────────
  const loadPartData = async (sermonId) => {
    if (!sermonId || loadedParts.current.has(sermonId)) return; // loaded or in-flight
    loadedParts.current.add(sermonId);
    setPartData((prev) => ({ ...prev, [sermonId]: { loading: true } }));

    try {
      const [{ data: refs }, { data: studies }, { data: decls }] = await Promise.all([
        supabase
          .from("sermon_scriptures")
          .select("*")
          .eq("sermon_id", sermonId)
          .order("order_index", { ascending: true }),
        supabase
          .from("sermon_word_studies")
          .select("*")
          .eq("sermon_id", sermonId)
          .order("order_index", { ascending: true }),
        supabase
          .from("declarations")
          .select("id, declaration_text, youtube_url_with_timestamp")
          .eq("sermon_id", sermonId)
          .limit(12),
      ]);

      // study_notes arrives with a later migration — never let its absence break.
      let notes = null;
      try {
        const { data: n, error } = await supabase
          .from("sermons")
          .select("study_notes")
          .eq("id", sermonId)
          .single();
        if (!error) notes = n?.study_notes || null;
      } catch {
        /* column not present yet */
      }

      setPartData((prev) => ({
        ...prev,
        [sermonId]: {
          loading: false,
          scriptures: refs || [],
          wordStudies: studies || [],
          declarations: decls || [],
          notes,
        },
      }));
    } catch (err) {
      console.error("loadPartData error:", err);
      loadedParts.current.delete(sermonId); // allow a retry
      setPartData((prev) => ({
        ...prev,
        [sermonId]: { loading: false, scriptures: [], wordStudies: [], declarations: [], notes: null },
      }));
    }
  };

  // ── lens switching (keeps the URL in sync without a reload) ───────
  const syncUrl = (path) => {
    try {
      window.history.replaceState(window.history.state, "", path);
    } catch {
      /* noop */
    }
  };

  const goSeries = () => {
    if (!hasSeries) return;
    setMode("series");
    setActiveTab("study");
    setShowAllDecls(false);
    syncUrl(`/series/${series.id}`);
  };

  const goMessage = (sermonId) => {
    const id = sermonId ?? activePartId ?? parts[0]?.id;
    if (!id) return;
    setActivePartId(id);
    setMode("message");
    setActiveTab("study");
    setShowAllDecls(false);
    if (!partData[id]) loadPartData(id);
    syncUrl(`/sermon/${id}`);
  };

  // ── derived ──────────────────────────────────────────────────────
  const activePart = parts.find((p) => p.id === activePartId) || null;
  const pd = activePartId ? partData[activePartId] : null;
  const isMsg = mode === "message";

  const tabs = useMemo(() => {
    if (!isMsg) return [];
    return [
      { key: "study", label: "Study", Icon: MessageSquare },
      pd && (pd.loading || pd.scriptures?.length) && {
        key: "scripture",
        label: "Scripture",
        Icon: BookOpen,
        count: pd.scriptures?.length || null,
      },
      pd && pd.wordStudies?.length > 0 && {
        key: "words",
        label: "Word study",
        Icon: Languages,
        count: pd.wordStudies.length,
      },
      pd && pd.notes && { key: "notes", label: "Notes", Icon: FileText },
    ].filter(Boolean);
  }, [isMsg, pd]);

  const nextPart = useMemo(() => {
    if (!isMsg || !activePart?.part_number) return null;
    return parts.find((p) => p.part_number === activePart.part_number + 1) || null;
  }, [isMsg, activePart, parts]);

  // Message-lens verse chips (most-read first).
  const msgTopRefs = useMemo(() => {
    if (!pd?.scriptures?.length) return [];
    const m = new Map();
    for (const s of pd.scriptures) {
      const c = m.get(s.reference);
      if (c) c.count += 1;
      else m.set(s.reference, { reference: s.reference, count: 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [pd]);

  // ── loading / error ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-dvh bg-brand-light flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-navy animate-spin" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="h-dvh bg-brand-light flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink mb-4">Not found</h1>
        <Link
          href="/series"
          className="text-brand-navy font-bold hover:underline flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Series
        </Link>
      </div>
    );
  }

  const formatDateRange = (start, end) => {
    if (!start) return "";
    const o = { month: "short", year: "numeric" };
    const s = new Date(start).toLocaleDateString("en-US", o);
    const e = end ? new Date(end).toLocaleDateString("en-US", o) : s;
    return s === e ? s : `${s} – ${e}`;
  };

  const headerTitle = isMsg && activePart ? cleanTitle(activePart.title) : series?.title;
  const headerSub = isMsg
    ? activePart?.summary ||
      "Study this message on its own — every answer is grounded in it alone."
    : summary || "Ask anything — every answer is grounded in these messages.";

  const msgDecls = pd?.declarations || [];
  const shownMsgDecls = showAllDecls ? msgDecls : msgDecls.slice(0, DECL_PREVIEW);
  const shownSeriesDecls = seriesDecls.slice(0, 3);

  return (
    <main className="h-dvh bg-background text-brand-ink flex flex-col lg:grid lg:grid-cols-[276px_minmax(0,1fr)] xl:grid-cols-[276px_minmax(0,1fr)_320px]">
      {/* ═══════════ Zone 1 · context + parts ═══════════ */}
      <aside className="hidden lg:flex flex-col min-h-0 bg-brand-light border-r border-brand-navy/10">
        <div className="px-5 pt-5 pb-3">
          <Link
            href="/series"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-gray hover:text-brand-navy transition-colors"
          >
            <ArrowLeft size={13} /> All series
          </Link>
          <h2 className="mt-3 text-lg font-bold text-brand-ink leading-tight">
            {series ? series.title : cleanTitle(activePart?.title)}
          </h2>
          <p className="mt-1 text-[11.5px] text-brand-gray">
            {series
              ? `${parts.length} ${parts.length === 1 ? "part" : "parts"} · ${formatDateRange(
                  series.start_date,
                  series.end_date
                )}`
              : "A single message"}
          </p>
        </div>

        {/* Active message, demoted to a compact thumbnail (message lens) */}
        {isMsg && activePart && (
          <div className="px-5 pb-3">
            <div className="relative rounded-2xl overflow-hidden bg-brand-deep aspect-[16/9] shadow-[0_10px_26px_-16px_rgba(16,42,78,0.6)]">
              {activePart.youtube_video_id && (
                <img
                  src={`https://img.youtube.com/vi/${activePart.youtube_video_id}/mqdefault.jpg`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/50 to-transparent" />
              {activePart.youtube_url && (
                <a
                  href={activePart.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Watch the message"
                  className="absolute inset-0 flex items-center justify-center group"
                >
                  <span className="w-11 h-11 rounded-full bg-white/92 text-brand-navy flex items-center justify-center shadow-lg shadow-black/30 group-hover:scale-105 transition-transform">
                    <Play size={16} fill="currentColor" className="translate-x-0.5" />
                  </span>
                </a>
              )}
            </div>
            {activePart.youtube_url && (
              <a
                href={activePart.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 flex items-center justify-center gap-2 w-full bg-brand-navy text-white text-[12.5px] font-bold rounded-xl py-2.5 hover:bg-brand-deep transition-colors"
              >
                <Play size={13} fill="currentColor" /> Watch the message
              </a>
            )}
          </div>
        )}

        {hasSeries && (
          <>
            <p className="px-5 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gray">
              Choose your lens
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-3">
              <ul className="flex flex-col gap-0.5">
                {/* Whole series — the broadest lens */}
                <li>
                  <button
                    onClick={goSeries}
                    className={`w-full group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                      mode === "series"
                        ? "bg-card shadow-sm shadow-brand-navy/10 border border-brand-navy/10"
                        : "border border-transparent hover:bg-brand-sky/70"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        mode === "series"
                          ? "bg-brand-navy text-white"
                          : "bg-brand-sky text-brand-navy group-hover:bg-brand-navy group-hover:text-white"
                      }`}
                    >
                      <Layers size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] font-bold leading-snug ${
                          mode === "series" ? "text-brand-navy" : "text-brand-ink"
                        }`}
                      >
                        Whole series
                      </span>
                      <span className="block text-[11px] text-brand-gray mt-0.5">
                        Study across all {parts.length} parts
                      </span>
                    </span>
                  </button>
                </li>

                <li className="px-2.5 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-brand-gray">
                  Or a single message
                </li>

                {parts.map((sermon) => {
                  const current = isMsg && sermon.id === activePartId;
                  return (
                    <li key={sermon.id}>
                      <button
                        onClick={() => goMessage(sermon.id)}
                        className={`w-full group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                          current
                            ? "bg-card shadow-sm shadow-brand-navy/10 border border-brand-navy/10"
                            : "border border-transparent hover:bg-brand-sky/70"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg text-[11.5px] font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                            current
                              ? "bg-brand-navy text-white"
                              : "bg-brand-sky text-brand-navy group-hover:bg-brand-navy group-hover:text-white"
                          }`}
                        >
                          {sermon.part_number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-[13px] font-bold leading-snug ${
                              current ? "text-brand-navy" : "text-brand-ink"
                            }`}
                          >
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
                        {sermon.youtube_url && (
                          <a
                            href={sermon.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Watch"
                            className="w-6 h-6 rounded-md border border-brand-navy/15 bg-card text-brand-navy flex items-center justify-center hover:bg-brand-sky flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Play size={9} fill="currentColor" />
                          </a>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        <div className="px-5 py-3.5 border-t border-brand-navy/10">
          <p className="text-[11px] text-brand-gray leading-relaxed">
            {!hasSeries
              ? "This message isn’t part of a series."
              : isMsg
              ? `Studying Part ${activePart?.part_number} on its own. Switch to “Whole series” to broaden every answer again.`
              : "Studying the whole series. Pick a part to zoom into one message."}
          </p>
        </div>
      </aside>

      {/* ═══════════ Zone 2 · workspace ═══════════ */}
      <section className="flex flex-col min-h-0 min-w-0 flex-1">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-brand-navy/10 bg-gradient-to-br from-brand-sky/50 to-card px-4 sm:px-7 pt-3.5">
          {/* Scope toggle */}
          {hasSeries && (
            <div className="flex items-center gap-3 flex-wrap">
              <div
                role="tablist"
                aria-label="Study scope"
                className="inline-flex p-0.5 bg-brand-sky border border-brand-navy/10 rounded-full"
              >
                <button
                  role="tab"
                  aria-selected={mode === "series"}
                  onClick={goSeries}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                    mode === "series"
                      ? "bg-card text-brand-navy shadow-sm shadow-brand-navy/10"
                      : "text-brand-gray hover:text-brand-ink"
                  }`}
                >
                  <Layers size={14} /> Whole series
                </button>
                <button
                  role="tab"
                  aria-selected={mode === "message"}
                  onClick={() => goMessage()}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                    mode === "message"
                      ? "bg-card text-brand-navy shadow-sm shadow-brand-navy/10"
                      : "text-brand-gray hover:text-brand-ink"
                  }`}
                >
                  <FileText size={14} /> This message
                </button>
              </div>
              <span className="text-[11px] text-brand-gray">
                {mode === "series" ? (
                  <>
                    Grounded in{" "}
                    <b className="text-brand-navy font-bold">all {parts.length} parts</b>
                  </>
                ) : (
                  <>
                    Grounded in <b className="text-brand-navy font-bold">this message only</b>
                  </>
                )}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2.5 flex-wrap mt-3">
            <Link href="/series" className="lg:hidden text-brand-gray hover:text-brand-navy">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-ink">
              {headerTitle}
            </h1>
            {isMsg && activePart?.part_number && (
              <span className="px-2.5 py-1 bg-brand-navy/10 border border-brand-navy/15 text-brand-navy rounded-full text-[9.5px] font-bold uppercase tracking-wider">
                Part {activePart.part_number}
                {series?.series_sermons ? ` of ${parts.length}` : ""}
              </span>
            )}
            <ThemeToggle className="ml-auto w-9 h-9 flex items-center justify-center rounded-full text-brand-gray hover:text-brand-navy hover:bg-brand-sky transition-colors flex-shrink-0" />
          </div>

          <div className="mt-1.5 text-[13px] text-brand-gray leading-relaxed max-w-2xl">
            {!isMsg && summaryLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-brand-navy" />
                Reading the series…
              </span>
            ) : (
              <p className="line-clamp-2">{headerSub}</p>
            )}
          </div>

          {/* Tabs — message lens only (underlined, top of the workspace) */}
          {isMsg ? (
            <div
              role="tablist"
              aria-label="Message content"
              className="flex gap-1 mt-3.5 -mb-px overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(t.key)}
                    className={`inline-flex items-center gap-2 whitespace-nowrap px-3.5 pt-2.5 pb-3 text-[13px] font-bold border-b-2 transition-colors ${
                      active
                        ? "text-brand-navy border-brand-navy"
                        : "text-brand-gray border-transparent hover:text-brand-ink"
                    }`}
                  >
                    <t.Icon size={15} />
                    {t.label}
                    {t.count != null && (
                      <span
                        className={`text-[10.5px] font-bold rounded-full px-1.5 py-0.5 ${
                          active ? "bg-brand-navy text-white" : "bg-brand-sky text-brand-navy"
                        }`}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-3.5" />
          )}

          {/* Mobile part chips (no left rail on small screens) */}
          {hasSeries && (
            <div className="lg:hidden mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={goSeries}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                  mode === "series"
                    ? "bg-brand-navy text-white border-brand-navy"
                    : "bg-card text-brand-navy border-brand-navy/15 hover:bg-brand-sky"
                }`}
              >
                All parts
              </button>
              {parts.map((sermon) => {
                const current = isMsg && sermon.id === activePartId;
                return (
                  <button
                    key={sermon.id}
                    onClick={() => goMessage(sermon.id)}
                    className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                      current
                        ? "bg-brand-navy text-white border-brand-navy"
                        : "bg-card text-brand-navy border-brand-navy/15 hover:bg-brand-sky"
                    }`}
                  >
                    Part {sermon.part_number}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panels */}
        <div className="flex-1 min-h-0 relative">
          {/* Study — the grounded thread; remounts fresh when the scope changes */}
          {activeTab === "study" && (
            <div className="absolute inset-0 flex flex-col">
              <StudyChat
                key={isMsg ? `msg-${activePartId}` : "series"}
                seriesId={series?.id || null}
                sermonId={isMsg ? activePartId : null}
                openers={isMsg ? [] : summarySuggestions}
                placeholder={isMsg ? "Ask about this message…" : "Ask about this series…"}
                hint={
                  isMsg
                    ? "Answers come only from this message — every claim is cited."
                    : `Answers come only from these ${parts.length} messages — every claim is cited.`
                }
                emptyNote={
                  isMsg
                    ? "Ask anything about this message — the exact moments behind each answer come with it."
                    : "Ask anything about this series — the exact moments behind each answer come with it."
                }
              />
            </div>
          )}

          {isMsg && activeTab === "scripture" && (
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-4 sm:px-7 py-6">
              <div className="max-w-3xl mx-auto">
                {pd?.loading ? (
                  <div className="rounded-3xl border border-brand-navy/10 bg-card p-6 flex items-center gap-3 text-brand-gray">
                    <Loader2 size={16} className="animate-spin text-brand-navy" />
                    <span className="text-sm">Loading scriptures…</span>
                  </div>
                ) : (
                  <VerseExplorer sermonId={activePartId} scriptures={pd?.scriptures || []} />
                )}
              </div>
            </div>
          )}

          {isMsg && activeTab === "words" && (
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-4 sm:px-7 py-6">
              <div className="max-w-3xl mx-auto">
                <div className="rounded-3xl border border-brand-navy/10 bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <span className="w-9 h-9 rounded-xl bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
                      <Languages size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-brand-ink">Word study</span>
                      <span className="block text-xs text-brand-gray">
                        The original Greek behind the message — tap a word
                      </span>
                    </span>
                  </div>
                  <WordStudy sermonId={activePartId} words={pd?.wordStudies || []} embedded />
                </div>
              </div>
            </div>
          )}

          {isMsg && activeTab === "notes" && pd?.notes && (
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-4 sm:px-7 py-6">
              <div className="max-w-3xl mx-auto">
                <div className="rounded-3xl border border-brand-navy/10 bg-card p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-9 h-9 rounded-xl bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
                      <FileText size={17} />
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
                      {pd.notes}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ Zone 3 · at a glance ═══════════ */}
      <aside className="hidden xl:flex flex-col min-h-0 bg-brand-light border-l border-brand-navy/10 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gray px-1">
            {isMsg ? "Message at a glance" : "Series at a glance"}
          </p>

          {/* Stats */}
          <div className="flex gap-2.5">
            {(isMsg
              ? [
                  [
                    activePart?.part_number ? `${activePart.part_number}/${parts.length}` : "–",
                    "part",
                  ],
                  [pd?.loading ? "–" : pd?.scriptures?.length ?? 0, "scriptures"],
                  [pd?.loading ? "–" : pd?.declarations?.length ?? 0, "declarations"],
                ]
              : [
                  [parts.length, parts.length === 1 ? "part" : "parts"],
                  [scriptureStats?.total ?? "–", "scriptures"],
                  [seriesDecls.length, "declarations"],
                ]
            ).map(([n, label]) => (
              <div
                key={label}
                className="flex-1 rounded-xl border border-brand-navy/10 bg-card py-2.5 text-center"
              >
                <p className="text-lg font-bold text-brand-ink tabular-nums leading-tight">{n}</p>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-gray">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Verses */}
          {isMsg ? (
            msgTopRefs.length > 0 && (
              <div className="rounded-2xl border border-brand-navy/10 bg-card p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-1 flex items-center gap-1.5">
                  <BookOpen size={11} className="text-brand-navy" />
                  Verses in this message
                </h3>
                <p className="text-[10.5px] text-brand-gray mb-3">
                  Tap to open the Scripture tab and read them in full.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {msgTopRefs.map((v) => (
                    <button
                      key={v.reference}
                      onClick={() => setActiveTab("scripture")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/10 bg-brand-sky px-3 py-1.5 text-[11.5px] font-bold text-brand-navy hover:border-brand-navy/40 transition-colors"
                    >
                      {v.reference}
                      {v.count > 1 && (
                        <span className="text-[10px] text-brand-navy/50 font-semibold">
                          ×{v.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab("scripture")}
                  className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-navy hover:underline"
                >
                  Open the Scripture tab <ArrowUpRight size={11} />
                </button>
              </div>
            )
          ) : (
            scriptureStats?.top?.length > 0 && (
              <div className="rounded-2xl border border-brand-navy/10 bg-card p-4">
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
            )
          )}

          {/* Declarations */}
          <div className="rounded-2xl border border-brand-navy/10 bg-card p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-3 flex items-center gap-1.5">
              <Quote size={11} className="text-brand-navy" />
              {isMsg ? "Declarations from this message" : "Key declarations"}
            </h3>
            {isMsg ? (
              pd?.loading ? (
                <p className="text-[11.5px] text-brand-gray">Loading…</p>
              ) : msgDecls.length > 0 ? (
                <div className="space-y-4">
                  {shownMsgDecls.map((d) => {
                    const parsed = parseYoutubeUrl(d.youtube_url_with_timestamp);
                    return (
                      <div key={d.id}>
                        <p className="text-[12.5px] italic text-brand-ink leading-relaxed">
                          &ldquo;{d.declaration_text}&rdquo;
                        </p>
                        {parsed && (
                          <button
                            type="button"
                            onClick={() =>
                              setWatching({
                                ...parsed,
                                sermon_title: activePart?.title,
                              })
                            }
                            className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-brand-navy hover:underline"
                          >
                            <Play size={8} fill="currentColor" /> Watch moment
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {msgDecls.length > DECL_PREVIEW && (
                    <button
                      onClick={() => setShowAllDecls((v) => !v)}
                      className="text-[11px] font-bold text-brand-navy hover:underline"
                    >
                      {showAllDecls ? "Show fewer" : `Show all ${msgDecls.length}`}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[11.5px] text-brand-gray leading-relaxed">
                  Declarations from this message are being prepared.
                </p>
              )
            ) : shownSeriesDecls.length > 0 ? (
              <div className="space-y-4">
                {shownSeriesDecls.map((decl) => {
                  const parsed = parseYoutubeUrl(decl.youtube_url_with_timestamp);
                  return (
                    <div key={decl.id}>
                      <p className="text-[12.5px] italic text-brand-ink leading-relaxed">
                        &ldquo;{decl.declaration_text}&rdquo;
                      </p>
                      {parsed && (
                        <button
                          type="button"
                          onClick={() =>
                            setWatching({
                              ...parsed,
                              sermon_title: decl.sermon_title,
                            })
                          }
                          className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-brand-navy hover:underline"
                        >
                          <Play size={8} fill="currentColor" /> Watch moment
                        </button>
                      )}
                    </div>
                  );
                })}
                {seriesDecls.length > 3 && (
                  <p className="text-[11px] text-brand-gray">
                    + {seriesDecls.length - 3} more across the series
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11.5px] text-brand-gray leading-relaxed">
                Declarations from this series are being prepared.
              </p>
            )}
          </div>

          {/* Up next — message lens only */}
          {isMsg && nextPart && (
            <button
              onClick={() => goMessage(nextPart.id)}
              className="w-full text-left rounded-2xl border border-brand-navy/10 bg-card p-4 hover:border-brand-navy/30 transition-colors group"
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray mb-3">
                Up next in this series
              </h3>
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
            </button>
          )}

          {/* Broaden back to the series (message lens) */}
          {isMsg && hasSeries && (
            <button
              onClick={goSeries}
              className="w-full flex items-center justify-between gap-3 rounded-2xl border border-brand-navy/10 bg-gradient-to-br from-brand-sky/70 to-card px-4 py-3.5 hover:border-brand-navy/40 transition-colors group text-left"
            >
              <span>
                <span className="block text-[13px] font-bold text-brand-navy">
                  Study the whole series
                </span>
                <span className="block text-[11.5px] text-brand-gray">
                  Ask across all {parts.length} parts
                </span>
              </span>
              <ArrowRight
                size={17}
                className="text-brand-navy flex-shrink-0 group-hover:translate-x-1 transition-transform"
              />
            </button>
          )}
        </div>
      </aside>

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </main>
  );
}
