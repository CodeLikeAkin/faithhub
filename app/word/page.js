"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, Loader2, Play, Calendar, X, Layers } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BOOK_ORDER, OT_COUNT, BOOK_ABBR, bookIdFor } from "@/lib/bible";

/**
 * The Word — a reverse scripture index over every message.
 *
 * Reads live from `sermon_scriptures`, so it fills in automatically as the
 * extraction pipeline covers more sermons — no code change needed. Two views:
 *   1. A heat-map of the whole Bible, each book shaded by how often Pastor
 *      has opened it.
 *   2. Click a book → every sermon that opened it, plus a chapter breakdown.
 */

// #173A68 (brand navy) as an RGB triple, so we can shade tiles continuously.
const NAVY_RGB = "23, 58, 104";

function tileStyle(intensity) {
  // Keep even the lowest non-zero count visible; ramp up to solid navy.
  const alpha = 0.1 + 0.85 * intensity;
  return {
    backgroundColor: `rgba(${NAVY_RGB}, ${alpha})`,
    color: intensity > 0.5 ? "#fff" : "#173A68",
  };
}

export default function WordPage() {
  const [counts, setCounts] = useState(null); // { [bookId]: { refs, sermons } }
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { bookId, name }
  const detailRef = useRef(null);

  // ── Load per-book aggregates ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const byId = {};

      // Fast path: grouped RPC (word_stats.sql). Falls back to client-side
      // aggregation if the migration hasn't been applied yet.
      const { data: rpc, error: rpcErr } = await supabase.rpc("word_book_stats");

      if (!rpcErr && Array.isArray(rpc)) {
        for (const row of rpc) {
          const id = row.book_id || bookIdFor(row.book);
          if (!id) continue;
          byId[id] = {
            refs: Number(row.ref_count) || 0,
            sermons: Number(row.sermon_count) || 0,
          };
        }
      } else {
        // Fallback: page the table and aggregate in the browser.
        const pageSize = 1000;
        const seen = {}; // bookId -> Set of sermon ids (for distinct count)
        let from = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from("sermon_scriptures")
            .select("book, book_id, sermon_id")
            .range(from, from + pageSize - 1);
          if (error || !data?.length) break;
          for (const r of data) {
            const id = r.book_id || bookIdFor(r.book);
            if (!id) continue;
            byId[id] ||= { refs: 0, sermons: 0 };
            byId[id].refs += 1;
            (seen[id] ||= new Set()).add(r.sermon_id);
          }
          if (data.length < pageSize) break;
          from += pageSize;
        }
        for (const id of Object.keys(seen)) byId[id].sermons = seen[id].size;
      }

      if (!cancelled) {
        setCounts(byId);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    if (!counts) return { refs: 0, books: 0, maxRefs: 1 };
    const ids = Object.keys(counts);
    let refs = 0;
    let maxRefs = 1;
    for (const id of ids) {
      refs += counts[id].refs;
      if (counts[id].refs > maxRefs) maxRefs = counts[id].refs;
    }
    return { refs, books: ids.length, maxRefs };
  }, [counts]);

  const openBook = (name) => {
    const bookId = bookIdFor(name);
    if (!bookId || !counts?.[bookId]) return;
    setSelected({ bookId, name });
    // Let the detail render, then scroll it into view. Schedule with setTimeout
    // rather than a single rAF: rAF is throttled (or never fires) in some
    // embedded/background contexts, which would make the tap a silent no-op.
    // Retry until the (large) detail has laid out, then snap if the browser
    // ignored the smooth scroll.
    let tries = 0;
    const bring = () => {
      const el = detailRef.current;
      if (!el) {
        if (tries++ < 8) setTimeout(bring, 50);
        return;
      }
      const before = window.scrollY;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        if (Math.abs(window.scrollY - before) < 4 && detailRef.current) {
          detailRef.current.scrollIntoView({ block: "start" });
        }
      }, 400);
    };
    setTimeout(bring, 50);
  };

  const renderGrid = (books) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 sm:gap-2.5">
      {books.map((name) => {
        const id = bookIdFor(name);
        const c = id ? counts?.[id] : null;
        const refs = c?.refs || 0;
        const intensity = refs ? refs / totals.maxRefs : 0;
        const active = refs > 0;

        return (
          <button
            key={name}
            onClick={() => active && openBook(name)}
            disabled={!active}
            style={active ? tileStyle(intensity) : undefined}
            className={`group relative flex flex-col justify-between rounded-2xl p-2.5 sm:p-3 h-[74px] sm:h-[84px] text-left transition-all ${
              active
                ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-navy/20 cursor-pointer"
                : "bg-white border border-brand-navy/8 cursor-default"
            } ${
              selected?.name === name
                ? "ring-2 ring-brand-navy ring-offset-2"
                : ""
            }`}
            title={active ? `${refs} references` : "Not opened yet"}
            aria-label={active ? `${name}: ${refs} references` : `${name}: not opened yet`}
          >
            <span
              className={`text-xs font-bold leading-tight ${
                active ? "" : "text-brand-gray/50"
              }`}
            >
              {BOOK_ABBR[name] || name}
            </span>
            <span
              className={`text-base sm:text-lg font-bold ${
                active ? "" : "text-brand-gray/30"
              }`}
            >
              {refs || "—"}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="min-h-screen bg-white">
      {/* Heading */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-28 sm:pt-36 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-navy">
              The Word
            </p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-bold text-brand-ink tracking-tight">
              Every scripture, in every message.
            </h1>
            <p className="mt-3 text-brand-gray max-w-xl leading-relaxed">
              A living concordance of Dad&apos;s teaching. Every passage
              he opens is mapped here — see what he returns to most, then trace
              any book to the messages that unpack it.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-full self-start sm:self-auto flex-shrink-0">
            <BookMarked size={15} />
            <span className="text-xs font-bold">The Word</span>
          </span>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Stat value={totals.refs.toLocaleString()} label="Scripture references" />
            <Stat value={totals.books} label="Books opened" />
            <Stat value={`${Math.round((totals.books / 66) * 100)}%`} label="of the Bible touched" />
          </div>
        )}
      </section>

      {/* Heat-map */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-8">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 sm:gap-2.5">
            {[...Array(28)].map((_, i) => (
              <div
                key={i}
                className="h-[74px] sm:h-[84px] rounded-2xl bg-brand-sky animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-brand-navy" />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">
                Old Testament
              </h2>
            </div>
            {renderGrid(BOOK_ORDER.slice(0, OT_COUNT))}

            <div className="flex items-center gap-2 mt-8 mb-3">
              <Layers size={14} className="text-brand-navy" />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">
                New Testament
              </h2>
            </div>
            {renderGrid(BOOK_ORDER.slice(OT_COUNT))}

            {/* Legend */}
            <div className="mt-6 flex items-center gap-3 text-xs text-brand-gray">
              <span className="font-medium">Fewer</span>
              <div className="flex gap-1">
                {[0.1, 0.3, 0.5, 0.7, 0.95].map((a) => (
                  <span
                    key={a}
                    className="w-6 h-4 rounded"
                    style={{ backgroundColor: `rgba(${NAVY_RGB}, ${a})` }}
                  />
                ))}
              </div>
              <span className="font-medium">More · shaded by how often it&apos;s opened</span>
            </div>
          </>
        )}
      </section>

      {/* Selected-book detail */}
      {selected && (
        <div ref={detailRef}>
          <BookDetail
            bookId={selected.bookId}
            name={selected.name}
            stats={counts?.[selected.bookId]}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </main>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex items-baseline gap-2 px-4 py-2.5 bg-brand-sky rounded-2xl border border-brand-navy/10">
      <span className="text-lg font-bold text-brand-navy">{value}</span>
      <span className="text-xs font-medium text-brand-gray">{label}</span>
    </div>
  );
}

// ── Per-book detail: sermons that opened this book + chapter breakdown ───────
const INITIAL_SERMONS = 48; // cap the first render — popular books cite 200+ messages

function BookDetail({ bookId, name, stats, onClose }) {
  const [rows, setRows] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setShowAll(false);
    (async () => {
      const { data } = await supabase
        .from("sermon_scriptures")
        .select(
          "id, reference, chapter, order_index, sermon:sermons ( id, title, sermon_date, youtube_video_id, service_type )"
        )
        .eq("book_id", bookId)
        .order("chapter", { ascending: true });
      if (!cancelled) setRows(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Group references by sermon.
  const bySermon = useMemo(() => {
    if (!rows) return [];
    const map = new Map();
    for (const r of rows) {
      if (!r.sermon) continue;
      const s = r.sermon;
      if (!map.has(s.id)) map.set(s.id, { sermon: s, refs: [] });
      map.get(s.id).refs.push(r);
    }
    // Most references first.
    return [...map.values()].sort((a, b) => b.refs.length - a.refs.length);
  }, [rows]);

  // Chapter frequency.
  const chapters = useMemo(() => {
    if (!rows) return [];
    const map = new Map();
    for (const r of rows) map.set(r.chapter, (map.get(r.chapter) || 0) + 1);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  return (
    <section className="border-t border-brand-navy/10 bg-brand-sky/30">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-navy">
              Book of
            </p>
            <h2 className="mt-1 text-3xl sm:text-4xl font-bold text-brand-ink">
              {name}
            </h2>
            {stats && (
              <p className="mt-2 text-sm text-brand-gray">
                Opened <b className="text-brand-ink">{stats.refs}</b>{" "}
                {stats.refs === 1 ? "time" : "times"} across{" "}
                <b className="text-brand-ink">{stats.sermons}</b>{" "}
                {stats.sermons === 1 ? "message" : "messages"}.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 rounded-full bg-white border border-brand-navy/10 flex items-center justify-center text-brand-gray hover:text-brand-navy flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {rows === null ? (
          <div className="flex items-center gap-2 text-brand-gray py-10">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading messages…
          </div>
        ) : (
          <>
            {/* Chapter chips */}
            {chapters.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray mb-3">
                  Chapters opened
                </p>
                <div className="flex flex-wrap gap-2">
                  {chapters.map(([ch, n]) => (
                    <span
                      key={ch}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand-navy/10 rounded-full text-xs font-bold text-brand-navy"
                    >
                      {name} {ch}
                      <span className="text-xs text-brand-gray font-medium">
                        ×{n}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sermons that opened this book */}
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray mb-3">
              {bySermon.length} {bySermon.length === 1 ? "message" : "messages"} open this book
              {!showAll && bySermon.length > INITIAL_SERMONS && (
                <span className="ml-2 normal-case tracking-normal font-medium text-brand-gray/70">
                  · showing the {INITIAL_SERMONS} that open it most
                </span>
              )}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {(showAll ? bySermon : bySermon.slice(0, INITIAL_SERMONS)).map(({ sermon, refs }) => {
                const date = sermon.sermon_date
                  ? new Date(sermon.sermon_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : null;
                // Unique reference strings, in the order Pastor opened them.
                const uniqueRefs = [
                  ...new Map(refs.map((r) => [r.reference, r])).values(),
                ].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

                return (
                  <Link
                    key={sermon.id}
                    href={`/sermon/${sermon.id}`}
                    className="group flex gap-3 bg-white rounded-2xl border border-brand-navy/10 p-4 hover:border-brand-navy/25 hover:shadow-lg hover:shadow-brand-navy/10 transition-all"
                  >
                    {sermon.youtube_video_id && (
                      <div className="relative w-24 flex-shrink-0 rounded-xl overflow-hidden aspect-video">
                        <img
                          src={`https://img.youtube.com/vi/${sermon.youtube_video_id}/hqdefault.jpg`}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-brand-deep/20 flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Play size={16} className="text-white" fill="currentColor" />
                        </div>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-brand-ink leading-snug line-clamp-2 group-hover:text-brand-navy transition-colors">
                        {sermon.title}
                      </h3>
                      {date && (
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-brand-gray">
                          <Calendar size={11} />
                          {date}
                        </span>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {uniqueRefs.slice(0, 4).map((r) => (
                          <span
                            key={r.id}
                            className="px-2 py-0.5 bg-brand-sky rounded-md text-xs font-bold text-brand-navy"
                          >
                            {r.reference}
                          </span>
                        ))}
                        {uniqueRefs.length > 4 && (
                          <span className="px-2 py-0.5 text-xs font-bold text-brand-gray">
                            +{uniqueRefs.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {!showAll && bySermon.length > INITIAL_SERMONS && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAll(true)}
                  className="inline-flex items-center gap-2 bg-white border border-brand-navy/15 text-brand-navy font-bold text-sm rounded-full px-6 py-3 hover:bg-brand-sky transition-colors"
                >
                  Show all {bySermon.length} messages
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
