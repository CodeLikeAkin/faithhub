"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import ToolShell from "@/components/shell/ToolShell";
import { DotGrid, Rings } from "@/components/Decor";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { cleanTitle, displayTitle, parseSermonDate, partTitle } from "@/lib/titles";
import { detectSpeaker } from "@/lib/speakers";
import { clientIdHeader } from "@/lib/client-id";
import { cn } from "@/lib/utils";

/**
 * /series — the catalog: the latest series featured, then a row per year of
 * typographic covers, then guest speakers.
 *
 * `?q=` searches the whole library, in two legs that render as one list:
 * titles are matched locally against every sermon (instant, free, and it
 * reaches the messages the catalog doesn't surface), while /api/search runs
 * hybrid retrieval over sermon_segments for what was actually preached.
 */

const fmtRange = (start, end) => {
  if (!start) return "";
  const o = { month: "short", year: "numeric", timeZone: "UTC" };
  const s = new Date(start).toLocaleDateString("en-US", o);
  const e = end ? new Date(end).toLocaleDateString("en-US", o) : s;
  return s === e ? s : `${s} – ${e}`;
};

const fmtDay = (d) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

/**
 * The cover runs the full width of the card — no inset frame eating into the
 * picture — with the words small underneath. The fixed title height keeps the
 * grid's rows aligned whether a title wraps to one line or two.
 */
function SeriesCover({ s, className }) {
  return (
    <Link
      href={`/series/${s.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-brand-navy/10 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_50px_-30px_rgba(16,42,78,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
        className
      )}
    >
      <span className="relative block aspect-video w-full flex-shrink-0 overflow-hidden bg-brand-deep">
        {/* Shows through only when no part has a live thumbnail. */}
        <DotGrid dark className="inset-0" />
        <YtThumb
          ids={s.covers}
          quality="mqdefault"
          className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-brand-ink/80 px-1.5 py-0.5 text-xs font-semibold text-white">
          {s.parts} {s.parts === 1 ? "part" : "parts"}
        </span>
      </span>
      <span className="block px-2.5 pb-2.5 pt-2">
        <span className="line-clamp-2 h-[2.1875rem] hyphens-auto break-words font-display text-sm font-medium leading-tight text-brand-ink sm:h-[2.5rem] sm:text-base">
          {s.title}
        </span>
        <span className="mt-0.5 block text-xs text-brand-gray">{s.range || " "}</span>
      </span>
    </Link>
  );
}

function GuestCard({ g, className }) {
  return (
    <Link
      href={`/sermon/${g.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-brand-navy/10 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_50px_-30px_rgba(16,42,78,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
        className
      )}
    >
      <span className="relative block aspect-video w-full flex-shrink-0 overflow-hidden bg-brand-sky">
        {g.youtube_video_id && (
          <img
            src={`https://img.youtube.com/vi/${g.youtube_video_id}/mqdefault.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </span>
      <span className="block px-2.5 pb-2.5 pt-2">
        <span className="block truncate font-display text-sm font-medium leading-tight text-brand-ink sm:text-base">{g.speaker}</span>
        <span className="mt-0.5 line-clamp-2 text-xs text-brand-gray">{cleanTitle(g.title)}</span>
        {g.date && <span className="mt-0.5 block text-xs text-brand-gray">{fmtDay(g.date)}</span>}
      </span>
    </Link>
  );
}

/**
 * One message in the search results. When the hit came from the transcript
 * rather than the title, the link lands on that moment in the player and the
 * extract shows why it matched.
 */
function MessageRow({ m }) {
  const href = m.startSeconds != null ? `/sermon/${m.id}?t=${m.startSeconds}` : `/sermon/${m.id}`;
  const meta = [m.speaker, m.date ? fmtDay(m.date) : null, m.series?.title].filter(Boolean).join(" · ");
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-2xl border border-brand-navy/10 bg-white p-2.5 transition-[border-color,box-shadow] hover:border-brand-navy/25 hover:shadow-[0_20px_40px_-30px_rgba(23,58,104,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
    >
      <span className="relative aspect-video w-28 flex-shrink-0 self-start overflow-hidden rounded-xl bg-brand-sky sm:w-36">
        {m.videoId && (
          <img
            src={`https://img.youtube.com/vi/${m.videoId}/mqdefault.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {/* No `block` beside line-clamp-* — it overrides the -webkit-box
            display the clamp needs, and the text spills instead of clamping. */}
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-brand-ink group-hover:text-brand-navy">
          {m.title}
        </span>
        {meta && <span className="mt-0.5 block truncate text-xs text-brand-gray">{meta}</span>}
        {m.snippet && (
          <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-gray">
            &ldquo;{m.snippet}&rdquo;
          </span>
        )}
      </span>
    </Link>
  );
}

/** Sits beside the "Series" heading: narrows the grid below to one year. */
function YearFilterSelect({ value, onChange, years }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-3">
      <label htmlFor="year-filter" className="text-sm font-medium text-brand-gray">
        Filter by year
      </label>
      <div className="relative w-36">
        <select
          id="year-filter"
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-full border border-brand-navy/15 bg-white py-2.5 pl-4 pr-9 text-sm font-bold text-brand-ink focus:border-brand-navy/40 focus:outline-none"
        >
          <option value="All">All years</option>
          {years.map(([year]) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-gray"
        />
      </div>
    </div>
  );
}

// Every sermon, for the guest-speaker row. Paged: one select stops at
// PostgREST's 1,000 rows, and the corpus is heading past that.
async function fetchAllSermons() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("sermons")
      .select("id, title, sermon_date, youtube_video_id")
      .order("id")
      .range(from, from + 999);
    if (error) return { data: all, error };
    all.push(...(data || []));
    if (!data || data.length < 1000) return { data: all, error: null };
  }
}

export default function SeriesBrowsePage() {
  const [series, setSeries] = useState(null); // null = loading
  const [sermons, setSermons] = useState([]); // every message, series or not
  const [guests, setGuests] = useState([]);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filterYear, setFilterYear] = useState("All");
  // What was actually *said* — /api/search, debounced. Titles are matched
  // locally against `sermons`, so they land instantly without a round trip.
  const [spoken, setSpoken] = useState({ status: "idle", forQuery: "", items: [] });

  useEffect(() => {
    document.title = "Series Study · FaithHub";
    setQuery(new URLSearchParams(window.location.search).get("q") || "");
    let cancelled = false;
    (async () => {
      const [seriesRes, sermonsRes] = await Promise.all([
        supabase
          .from("series")
          .select("id, title, start_date, end_date, series_sermons ( part_number, sermons ( id, title, youtube_video_id ) )")
          .order("start_date", { ascending: false, nullsFirst: false }),
        fetchAllSermons(),
      ]);
      if (cancelled) return;
      if (seriesRes.error) {
        console.error("Error fetching series:", seriesRes.error);
        setError(true);
        setSeries([]);
        return;
      }
      setSeries(
        (seriesRes.data || []).map((s) => {
          const parts = [...(s.series_sermons || [])].sort((a, b) => a.part_number - b.part_number);
          return {
            id: s.id,
            title: displayTitle(s.title),
            start: s.start_date,
            year: s.start_date ? new Date(s.start_date).getUTCFullYear() : null,
            range: fmtRange(s.start_date, s.end_date),
            parts: parts.length,
            partList: parts.map((p) => ({ n: p.part_number, id: p.sermons?.id, title: partTitle(p.sermons?.title, s.title) })),
            // Every part's video, in order: YtThumb takes the first whose thumbnail is still live.
            covers: parts.map((p) => p.sermons?.youtube_video_id).filter(Boolean),
          };
        })
      );
      const all = (sermonsRes.data || []).map((s) => ({
        ...s,
        info: detectSpeaker(s.title),
        date: parseSermonDate(s.title) || (s.sermon_date ? new Date(s.sermon_date) : null),
      }));
      setSermons(all);
      setGuests(
        all
          .filter((s) => s.info.isGuest)
          .map((s) => ({ ...s, speaker: s.info.name }))
          .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateQuery = (q) => {
    setQuery(q);
    try {
      window.history.replaceState(null, "", q.trim() ? `/series?q=${encodeURIComponent(q.trim())}` : "/series");
    } catch {
      /* noop */
    }
  };

  const years = useMemo(() => {
    if (!series) return [];
    const map = new Map();
    for (const s of series) {
      const k = s.year ?? "Undated";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return [...map.entries()].sort((a, b) => (b[0] === "Undated" ? -1 : a[0] === "Undated" ? 1 : b[0] - a[0]));
  }, [series]);

  // Same bucketing as `years` (Undated included), so the dropdown's value
  // always lines up with a real group instead of falling through to "All".
  const filteredSeriesForYear = useMemo(() => {
    if (!series || filterYear === "All") return [];
    return series.filter((s) => String(s.year ?? "Undated") === filterYear);
  }, [series, filterYear]);

  const filteredGuestsForYear = useMemo(() => {
    if (filterYear === "All") return [];
    return guests.filter((g) => g.date && String(g.date.getUTCFullYear()) === filterYear);
  }, [guests, filterYear]);

  const q = query.trim().toLowerCase();

  // Which series a message belongs to, for the label on a result row.
  const seriesBySermon = useMemo(() => {
    const map = new Map();
    for (const s of series || []) for (const p of s.partList) if (p.id) map.set(p.id, s);
    return map;
  }, [series]);

  // Search what was preached, not just what it was called. Debounced, and
  // only past 3 characters — every fire costs an embed call and an RPC.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setSpoken({ status: "idle", forQuery: "", items: [] });
      return;
    }
    let cancelled = false;
    setSpoken((s) => ({ ...s, status: "loading" }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...clientIdHeader() },
          body: JSON.stringify({ q: term }),
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) setSpoken({ status: "done", forQuery: term, items: data.results || [] });
      } catch {
        if (!cancelled) setSpoken({ status: "error", forQuery: term, items: [] });
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const results = useMemo(() => {
    if (!q || !series) return null;
    const matchSeries = series.filter(
      (s) => s.title.toLowerCase().includes(q) || s.partList.some((p) => p.title?.toLowerCase().includes(q))
    );

    const byId = new Map(sermons.map((s) => [s.id, s]));
    const messages = [];
    const seen = new Set();
    const push = (sermon, snippet, startSeconds) => {
      if (!sermon || seen.has(sermon.id)) return;
      seen.add(sermon.id);
      messages.push({
        id: sermon.id,
        title: cleanTitle(sermon.title),
        videoId: sermon.youtube_video_id,
        date: sermon.date,
        series: seriesBySermon.get(sermon.id),
        speaker: sermon.info?.isGuest ? sermon.info.name : null,
        snippet,
        startSeconds,
      });
    };

    // Title hits first — they're what someone typing a remembered name wants.
    for (const s of sermons) {
      if (cleanTitle(s.title).toLowerCase().includes(q) || s.info?.name?.toLowerCase().includes(q)) {
        push(s, null, null);
      }
    }
    // Then what was said, ranked by the hybrid search.
    if (spoken.status === "done" && spoken.forQuery === query.trim()) {
      for (const r of spoken.items) {
        const sermon = byId.get(r.sermonId);
        push(sermon || { id: r.sermonId, title: r.title, youtube_video_id: r.videoId }, r.snippet, r.startSeconds);
      }
    }

    return { series: matchSeries, messages, searching: spoken.status === "loading" };
  }, [q, query, series, sermons, seriesBySermon, spoken]);

  const featured = series?.[0];
  const totalMessages = series ? series.reduce((n, s) => n + s.parts, 0) : 0;

  return (
    <ToolShell kind="series" title="Series Study" titleAs="p">
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <header className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pt-10 sm:px-8 sm:pt-14 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">Series Study</h1>
            <p className="mt-3 text-lg text-brand-gray">
              {series?.length
                ? `${series.length} series · ${totalMessages} messages, each one a course to study and ask about.`
                : "Rev. Peter’s teaching, series by series."}
            </p>
          </div>
          <div className="relative w-full lg:w-96">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" />
            <input
              type="search"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder="Search every series and message"
              aria-label="Search every series and message"
              className="h-12 w-full rounded-full border border-brand-navy/15 bg-white pl-11 pr-11 text-base text-brand-ink placeholder:text-brand-gray/70 focus:border-brand-navy/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => updateQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-brand-gray hover:bg-brand-sky hover:text-brand-navy"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {series === null && (
          <div aria-hidden="true" className="mx-auto mt-10 max-w-[1400px] px-2 sm:px-8">
            <div className="h-72 rounded-[2rem] bg-brand-sky motion-safe:animate-pulse" />
            <div className="mt-10 flex gap-4 overflow-hidden">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[4/5] w-52 flex-shrink-0 rounded-[1.5rem] bg-brand-sky/70 motion-safe:animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mx-auto mt-10 max-w-[1400px] px-4 text-brand-gray sm:px-8">
            Couldn&rsquo;t load the series just now. Please refresh in a moment.
          </p>
        )}

        {results ? (
          <section aria-label="Search results" className="mx-auto max-w-[1400px] px-2 pb-24 pt-10 sm:px-8">
            <p className="text-sm text-brand-gray" role="status">
              {results.searching && results.messages.length === 0 && results.series.length === 0
                ? `Searching every message for “${query.trim()}”…`
                : results.series.length + results.messages.length === 0
                ? `Nothing matches “${query.trim()}”.`
                : [
                    results.series.length ? `${results.series.length} series` : null,
                    results.messages.length
                      ? `${results.messages.length} ${results.messages.length === 1 ? "message" : "messages"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") + ` for “${query.trim()}”`}
            </p>

            {results.series.length > 0 && (
              <>
                <h2 className="mt-8 font-display text-2xl font-medium text-brand-ink">Series</h2>
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                  {results.series.map((s) => (
                    <li key={s.id}>
                      <SeriesCover s={s} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {results.messages.length > 0 && (
              <>
                <h2 className="mt-10 font-display text-2xl font-medium text-brand-ink">Messages</h2>
                <p className="mt-1 text-sm text-brand-gray">
                  Matched on the title or on what was preached &mdash; those open at the moment it was said
                </p>
                <ul className="mt-4 grid gap-2 sm:gap-3 lg:grid-cols-2">
                  {results.messages.map((m) => (
                    // min-w-0: a grid item's default min-width:auto lets a long
                    // title push the whole row past the container.
                    <li key={m.id} className="min-w-0">
                      <MessageRow m={m} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {results.searching && (results.series.length > 0 || results.messages.length > 0) && (
              <p className="mt-6 text-sm text-brand-gray" role="status">
                Still searching what was preached&hellip;
              </p>
            )}
          </section>
        ) : (
          series?.length > 0 && (
            <div className="pb-24">
              {filterYear === "All" ? (
                <>
                  {/* Latest series */}
                  {featured && (
                    <div className="mx-auto mt-10 max-w-[1400px] px-2 sm:px-8">
                      <section
                        aria-labelledby="latest-heading"
                        // minmax(0, …) on every track: a bare 1fr / implicit auto track won't
                        // shrink below its content's min-content, and the part titles are
                        // long no-wrap strings — they blew the columns out past the card
                        // (clipped titles, a wrapped button, a cropped cover on phones).
                        className="relative grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[1.75rem] bg-brand-deep text-white sm:rounded-[2.5rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
                      >
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                          {/* Blurred past legibility on purpose: the cover art carries
                              its own lettering, which fought the title when it sat
                              sharp behind it. The readable copy is framed below. */}
                          <YtThumb
                            ids={featured.covers}
                            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl"
                          />
                          <div className="absolute inset-0 bg-brand-deep/60" />
                          <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-navy/80 blur-3xl" />
                          <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_55%)]" />
                          <Rings className="absolute -bottom-56 -right-56 h-[36rem] w-[36rem] text-white/[0.06]" />
                        </div>
                        <div className="relative min-w-0 px-4 py-6 sm:px-12 sm:py-12">
                          <span className="mb-6 block aspect-video overflow-hidden rounded-2xl bg-brand-deep shadow-[0_25px_50px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15 sm:max-w-md">
                            <YtThumb ids={featured.covers} className="h-full w-full object-cover" />
                          </span>
                          <p className="text-sm text-white/70">Latest series</p>
                          <h2 id="latest-heading" className="mt-2 font-display text-3xl font-medium leading-[1.05] tracking-tight text-balance sm:text-5xl">
                            {featured.title}
                          </h2>
                          <p className="mt-4 text-sm text-white/65">
                            {featured.parts} parts{featured.range && ` · ${featured.range}`}
                          </p>
                          <div className="mt-8 flex flex-wrap gap-3">
                            {featured.partList[0]?.id && (
                              <Link
                                href={`/sermon/${featured.partList[0].id}`}
                                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky sm:text-base"
                              >
                                Start with Part 1 <ArrowRight size={16} aria-hidden="true" />
                              </Link>
                            )}
                            <Link
                              href={`/series/${featured.id}`}
                              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:text-base"
                            >
                              Open the series
                            </Link>
                          </div>
                        </div>
                        <ol className="relative min-w-0 border-t border-white/10 px-4 py-4 sm:px-8 lg:border-l lg:border-t-0 lg:py-10">
                          {featured.partList.slice(0, 6).map((p) => (
                            <li key={p.id || p.n}>
                              <Link
                                href={`/sermon/${p.id}`}
                                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.07]"
                              >
                                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-white/25 text-sm font-bold tabular-nums">
                                  {p.n}
                                </span>
                                <span className="min-w-0 truncate text-sm text-white/85">{p.title}</span>
                              </Link>
                            </li>
                          ))}
                          {featured.parts > 6 && (
                            <li className="px-2 pt-2 text-sm text-white/60">+ {featured.parts - 6} more parts</li>
                          )}
                        </ol>
                      </section>
                    </div>
                  )}

                  <div className="mx-auto mt-12 max-w-[1400px] px-2 sm:px-8">
                    <section aria-labelledby="all-series-heading">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <h2 id="all-series-heading" className="font-display text-2xl font-medium text-brand-ink">
                            Series
                          </h2>
                          <p className="mt-1 text-sm text-brand-gray">{series.length} series</p>
                        </div>
                        <YearFilterSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)} years={years} />
                      </div>
                      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                        {series.map((s) => (
                          <li key={s.id}>
                            <SeriesCover s={s} />
                          </li>
                        ))}
                      </ul>
                    </section>

                    {guests.length > 0 && (
                      <section aria-labelledby="all-guests-heading" className="mt-12">
                        <h2 id="all-guests-heading" className="font-display text-2xl font-medium text-brand-ink">
                          Guest speakers
                        </h2>
                        <p className="mt-1 text-sm text-brand-gray">
                          {guests.length} messages from ministers who visited Heritage of Faith
                        </p>
                        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                          {guests.map((g) => (
                            <li key={g.id}>
                              <GuestCard g={g} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                </>
              ) : (
                <div className="mx-auto mt-10 max-w-[1400px] px-2 sm:px-8">
                  {filteredSeriesForYear.length === 0 && filteredGuestsForYear.length === 0 ? (
                    <div className="flex flex-col items-center py-24 text-center">
                      <p className="text-lg font-medium text-brand-ink">Nothing from {filterYear}.</p>
                      <p className="mt-2 text-sm text-brand-gray">Try a different year.</p>
                      <button
                        type="button"
                        onClick={() => setFilterYear("All")}
                        className="mt-6 text-sm font-bold text-brand-navy hover:underline"
                      >
                        Reset filter
                      </button>
                    </div>
                  ) : (
                    <>
                      {filteredSeriesForYear.length > 0 && (
                        <section aria-labelledby="filtered-series-heading">
                          <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                              <h2 id="filtered-series-heading" className="font-display text-2xl font-medium text-brand-ink">
                                Series
                              </h2>
                              <p className="mt-1 text-sm text-brand-gray">
                                {filteredSeriesForYear.length} series in {filterYear}
                              </p>
                            </div>
                            <YearFilterSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)} years={years} />
                          </div>
                          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                            {filteredSeriesForYear.map((s) => (
                              <li key={s.id}>
                                <SeriesCover s={s} />
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {filteredGuestsForYear.length > 0 && (
                        <section
                          aria-labelledby="filtered-guests-heading"
                          className={filteredSeriesForYear.length > 0 ? "mt-12" : undefined}
                        >
                          <h2 id="filtered-guests-heading" className="font-display text-2xl font-medium text-brand-ink">
                            Guest speakers
                          </h2>
                          <p className="mt-1 text-sm text-brand-gray">
                            {filteredGuestsForYear.length} guest {filteredGuestsForYear.length === 1 ? "message" : "messages"} in {filterYear}
                          </p>
                          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                            {filteredGuestsForYear.map((g) => (
                              <li key={g.id}>
                                <GuestCard g={g} />
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </ToolShell>
  );
}
