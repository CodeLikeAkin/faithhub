"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { clientIdHeader } from "@/lib/client-id";
import { displayTitle } from "@/lib/titles";

/**
 * Everything a series overview or a lesson needs, resolved from its entry
 * point:
 *
 *   entry = { type: "series", seriesId } | { type: "sermon", sermonId }
 *
 * - A sermon resolves its series (if any); a sermon in no series is a "solo"
 *   message with a single part.
 * - `withSeriesExtras` loads series-level declarations + key-verse stats
 *   (stored key verses win; aggregate live only when they're absent).
 * - `withSummary` loads the series summary + openers: the stored value costs
 *   nothing, otherwise /api/series-summary (Groq) writes and caches it.
 * - Per-message data (scriptures, word studies, declarations, notes) loads
 *   on demand via loadPartData(id) and is cached per sermon.
 */
export function useSeriesBundle(entry, { withSeriesExtras = false, withSummary = false } = {}) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [series, setSeries] = useState(null); // null for a solo message
  const [parts, setParts] = useState([]); // sermons in part order
  const [seriesDecls, setSeriesDecls] = useState([]);
  const [scriptureStats, setScriptureStats] = useState(null); // { total, top }
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySuggestions, setSummarySuggestions] = useState([]);
  const [partData, setPartData] = useState({}); // sermonId -> { loading, scriptures, wordStudies, declarations, notes }
  const loadedParts = useRef(new Set()); // sermonIds loaded or in flight

  const loadPartData = useCallback(async (sermonId) => {
    if (!sermonId || loadedParts.current.has(sermonId)) return;
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
  }, []);

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
          // Not maybeSingle(): a handful of messages are filed under two
          // series, and asking for one row makes PostgREST reject the whole
          // query (406) — which used to drop the message to "no series",
          // losing its course outline. Take the lowest part number instead.
          const { data: links } = await supabase
            .from("series_sermons")
            .select("part_number, series ( id, title )")
            .eq("sermon_id", entrySermonId)
            .order("part_number", { ascending: true });
          const link = (links || []).find((l) => l?.series) || null;

          if (link?.series) {
            seriesId = link.series.id;
          } else {
            // Solo message — no series to broaden into.
            const { data: s } = await supabase
              .from("sermons")
              .select("id, title, sermon_date, youtube_video_id, youtube_url, summary, service_type")
              .eq("id", entrySermonId)
              .single();
            if (cancelled) return;
            if (!s) {
              setNotFound(true);
              return;
            }
            setSeries(null);
            setParts([{ ...s, part_number: null }]);
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

        setSeries({ ...data, title: displayTitle(data.title) });
        const sorted = data.series_sermons
          .sort((a, b) => a.part_number - b.part_number)
          .map((ss) => ({ ...ss.sermons, part_number: ss.part_number }));
        setParts(sorted);

        if (entrySermonId) loadPartData(entrySermonId);

        if (withSeriesExtras) {
          const sermonIds = sorted.map((s) => s.id);
          const wantRefs = !Array.isArray(data.key_verses) || !data.key_verses.length;
          const [{ data: decls }, refsRes] = await Promise.all([
            supabase
              .from("declarations")
              .select("id, sermon_id, declaration_text, youtube_url_with_timestamp")
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
            const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6);
            setScriptureStats({ total: refsRes.data.length, top });
          } else {
            setScriptureStats({ total: 0, top: [] });
          }
        }
      } catch (err) {
        console.error("useSeriesBundle boot error:", err);
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

  // Series summary + openers — the stored value costs zero tokens.
  useEffect(() => {
    if (!withSummary || !series || parts.length === 0 || summary) return;
    if (series.study_summary) {
      setSummary(series.study_summary);
      if (Array.isArray(series.suggested_questions)) setSummarySuggestions(series.suggested_questions);
      return;
    }
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch("/api/series-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...clientIdHeader() },
          body: JSON.stringify({
            seriesId: series.id,
            title: series.title,
            sermonTitles: parts.map((s) => s.title),
            sermonIds: parts.map((s) => s.id),
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
  }, [withSummary, series, parts, summary]);

  return {
    loading,
    notFound,
    series,
    parts,
    seriesDecls,
    scriptureStats,
    summary,
    summaryLoading,
    summarySuggestions,
    partData,
    loadPartData,
  };
}
