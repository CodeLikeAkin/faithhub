"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Flame, Play, RotateCcw, Volume2 } from "lucide-react";
import ToolShell from "@/components/shell/ToolShell";
import { copyText, useToast } from "@/components/shell/Toast";
import Composer from "@/components/ask/Composer";
import Button from "@/components/Button";
import VideoModal from "@/components/VideoModal";
import Masthead from "@/components/shell/Masthead";
import DeclarationLine from "@/components/declarations/DeclarationLine";
import SpeakMode from "@/components/declarations/SpeakMode";
import {
  THEMES,
  fetchThemeCount,
  fetchThemePage,
  themeBySlug,
  fetchTodaysDeclaration,
  normalizeDeclaration,
  streakLabel,
  toggleSaved,
  useSavedDeclarations,
  useStreak,
} from "@/lib/declarations";
import { clientIdHeader } from "@/lib/client-id";
import { cleanTitle } from "@/lib/titles";
import { parseYoutubeUrl } from "@/lib/youtube";
import { scrollToElement } from "@/lib/scroll";
import { cn } from "@/lib/utils";

/**
 * Declarations — a library of Rev. Peter's declarations to speak.
 *
 *   /declarations                     "What are you facing?" + today's declaration (navy
 *                                     masthead), theme chips with that theme's newest
 *                                     declarations in place, My declarations
 *   /declarations?theme=<slug>        …with that theme chosen
 *   /declarations?facing=<text>       …with declarations for that situation
 *   /declarations?speak=today|mine    …opened straight into Speak mode
 *   /declarations/[theme]             every declaration on one theme
 *   /declarations/mine                My declarations — the saved set to speak daily
 *
 * Themes are a tag filter (lib/declarations.js); only "What are you facing?"
 * uses /api/declarations (embed → hybrid search → Groq's short note).
 */

const apiError = (data) =>
  typeof data?.error === "string"
    ? data.error
    : data?.message || "Something went wrong, please try again in a moment.";

function setParams(changes) {
  try {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    window.history.replaceState(null, "", url.pathname + url.search);
  } catch {
    /* noop */
  }
}

export default function DeclarationsPage() {
  const [today, setToday] = useState(undefined); // undefined = loading, null = unavailable
  const [counts, setCounts] = useState({});
  const [facing, setFacing] = useState(null); // { query, status, response, items, hasMore, loadingMore, error }
  const [speak, setSpeak] = useState(null); // { key, title, items }
  const [watching, setWatching] = useState(null);
  const [toast, showToast] = useToast();
  const saved = useSavedDeclarations();
  const streak = useStreak();
  const resultsRef = useRef(null);
  const [theme, setTheme] = useState(THEMES[0].slug);
  const [themeItems, setThemeItems] = useState(null); // null = loading
  const themeInfo = themeBySlug(theme) || THEMES[0];

  // The chosen theme's newest declarations (a topic_tags filter), shown in place.
  useEffect(() => {
    let live = true;
    setThemeItems(null);
    fetchThemePage(theme, 0, 8)
      .then((items) => live && setThemeItems(items))
      .catch(() => live && setThemeItems([]));
    return () => {
      live = false;
    };
  }, [theme]);

  const pickTheme = (slug) => {
    setTheme(slug);
    setParams({ theme: slug === THEMES[0].slug ? null : slug });
  };

  useEffect(() => {
    document.title = "Declarations · FaithHub";
    let cancelled = false;
    fetchTodaysDeclaration()
      .then((d) => !cancelled && setToday(d))
      .catch(() => !cancelled && setToday(null));
    Promise.all(THEMES.map((t) => fetchThemeCount(t.slug).then((n) => [t.slug, n]))).then(
      (pairs) => !cancelled && setCounts(Object.fromEntries(pairs))
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const runFacing = async (query, { append = false } = {}) => {
    const q = query.trim();
    // Also guards the ?facing= deep link, which doesn't go through the composer.
    if (q.length < 3) return false;
    const shownIds = append ? facing.items.map((d) => d.id).filter(Boolean) : [];
    if (append) setFacing((f) => ({ ...f, loadingMore: true }));
    else {
      setFacing({ query: q, status: "loading", items: [] });
      setParams({ facing: q });
      setTimeout(() => resultsRef.current && scrollToElement(resultsRef.current, { offset: 24 }), 60);
    }
    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...clientIdHeader() },
        body: JSON.stringify({ message: q, shownIds, topics: [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(data));
      const items = (data.declarations || []).map(normalizeDeclaration);
      setFacing((f) =>
        append
          ? { ...f, items: [...f.items, ...items], hasMore: !!data.hasMore && items.length > 0, loadingMore: false }
          : { query: q, status: "done", response: data.response, general: !!data.general, items, hasMore: !!data.hasMore }
      );
    } catch (err) {
      if (append) {
        setFacing((f) => ({ ...f, loadingMore: false }));
        showToast(err.message);
      } else setFacing({ query: q, status: "error", items: [], error: err.message });
    }
    return true;
  };

  const openSpeak = (key) => {
    const sets = {
      today: today && { title: "Today’s declaration", items: [today] },
      mine: saved.length > 0 && { title: "My declarations", items: saved },
      facing: facing?.items?.length > 0 && { title: `For: ${facing.query}`, items: facing.items },
      theme: themeItems?.length > 0 && { title: themeInfo.name, items: themeItems },
    };
    const set = sets[key];
    if (!set) return;
    setSpeak({ key, ...set });
    if (key === "today" || key === "mine") setParams({ speak: key });
  };

  const closeSpeak = () => {
    setSpeak(null);
    setParams({ speak: null });
  };

  // Deep links: ?facing= asks once; ?speak= opens once its set exists.
  const handledParams = useRef({ facing: false, speak: false });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = themeBySlug(params.get("theme"));
    if (t) setTheme(t.slug);
    const q = params.get("facing");
    if (q && !handledParams.current.facing) {
      handledParams.current.facing = true;
      runFacing(q.slice(0, 2000));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (handledParams.current.speak) return;
    const key = new URLSearchParams(window.location.search).get("speak");
    if (key === "today" && today) {
      handledParams.current.speak = true;
      openSpeak("today");
    } else if (key === "mine" && saved.length) {
      handledParams.current.speak = true;
      openSpeak("mine");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, saved.length]);

  const copy = (text) => copyText(text, showToast);
  const todayParsed = today ? parseYoutubeUrl(today.youtube_url_with_timestamp) : null;
  const todaySaved = today ? saved.some((d) => d.id === today.id) : false;
  const todayLong = (today?.declaration_text || "").length > 150;

  return (
    <ToolShell
      kind="declarations"
      title="Declarations"
      titleAs="p"
      coveredByOverlay={!!speak}
      overlay={
        <>
          {speak && <SpeakMode key={speak.key} title={speak.title} items={speak.items} onClose={closeSpeak} onCopy={copy} />}
          {toast}
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-5xl px-3 pb-28 pt-3 sm:px-8 sm:pt-8">
          <Masthead
            eyebrow="Declarations"
            title="Speak Life"
            description="Say it plainly. You’ll get declarations from Rev. Peter’s messages that speak to it, and a short word for you."
            aside={
              today !== null && (
                <section aria-labelledby="today-heading" className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 sm:p-6">
                  <h2 id="today-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
                    Today&rsquo;s declaration
                  </h2>
                  {today === undefined ? (
                    <div aria-hidden="true" className="mt-4 space-y-3">
                      <div className="h-6 w-11/12 rounded-full bg-white/10 motion-safe:animate-pulse" />
                      <div className="h-6 w-2/3 rounded-full bg-white/10 motion-safe:animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <blockquote
                        className={cn(
                          "mt-3 font-display font-normal leading-snug tracking-tight text-balance",
                          todayLong ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
                        )}
                      >
                        &ldquo;{today.declaration_text}&rdquo;
                      </blockquote>
                      {today.sermon_title && (
                        <p className="mt-3 text-sm text-white/60">
                          From <span className="font-semibold text-white/85">{cleanTitle(today.sermon_title)}</span>
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button variant="light" size="sm" icon={false} className="py-2.5" onClick={() => openSpeak("today")}>
                          <Volume2 className="h-4 w-4" aria-hidden="true" />
                          Speak it
                        </Button>
                        {todayParsed && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={false}
                            className="py-2.5"
                            onClick={() => setWatching({ ...todayParsed, sermon_title: today.sermon_title })}
                          >
                            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                            Watch
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          icon={false}
                          className="py-2.5"
                          onClick={() => toggleSaved(today)}
                          aria-pressed={todaySaved}
                        >
                          <Bookmark className="h-3.5 w-3.5" fill={todaySaved ? "currentColor" : "none"} aria-hidden="true" />
                          {todaySaved ? "Saved" : "Save"}
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              )
            }
          >
            <div className="mt-6 text-left">
              <Composer
                variant="hero"
                showScope={false}
                busy={facing?.status === "loading"}
                onSubmit={(q) => runFacing(q)}
                placeholder="A diagnosis, a debt, a decision, a fear…"
                submitLabel="Find declarations"
                /* A stray keystroke is not a need — the search stays shut
                   until there's a word to search on (see the API's
                   MIN_MESSAGE_LENGTH). */
                minLength={3}
              />
            </div>
          </Masthead>

          <div ref={resultsRef} className="w-full scroll-mt-6 text-left">
              {facing?.status === "loading" && (
                <div className="mt-8" role="status">
                  <p className="text-sm font-medium text-brand-gray">Finding declarations for you…</p>
                  <div aria-hidden="true" className="mt-5 space-y-5">
                    {[88, 72, 94].map((w) => (
                      <div key={w} className="h-6 rounded-full bg-brand-sky motion-safe:animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
              )}

              {facing?.status === "error" && (
                <div role="alert" className="mt-8 rounded-[1.5rem] border border-brand-navy/15 bg-brand-light p-5 sm:p-6">
                  <p className="text-base leading-relaxed text-brand-ink/90">{facing.error}</p>
                  <button
                    type="button"
                    onClick={() => runFacing(facing.query)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-4 py-2 text-sm font-bold text-brand-navy hover:bg-brand-sky"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Try again
                  </button>
                </div>
              )}

              {facing?.status === "done" && (
                <div className="mt-8">
                  <p className="text-sm text-brand-gray">
                    For <span className="font-semibold text-brand-ink">&ldquo;{facing.query}&rdquo;</span>
                  </p>
                  {facing.response &&
                    (facing.general ? (
                      /* Nothing matched what they shared. These are general
                         declarations, so they get a plain note — calling it
                         "A word for you" would claim they were chosen for
                         this person. */
                      <p className="mt-3 text-base leading-relaxed text-brand-gray">{facing.response}</p>
                    ) : (
                      <div className="mt-3 rounded-[1.5rem] bg-brand-sky/60 p-5 sm:p-6">
                        <p className="text-sm font-semibold text-brand-navy">A word for you</p>
                        <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-brand-ink/90">{facing.response}</p>
                      </div>
                    ))}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-medium text-brand-ink">Declarations to speak</h3>
                    <Button variant="dark" size="sm" icon={false} onClick={() => openSpeak("facing")} className="py-2.5">
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      Speak these
                    </Button>
                  </div>
                  <ol className="mt-2 divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                    {facing.items.map((d, i) => (
                      <DeclarationLine key={d.id || i} declaration={d} index={i} onWatch={setWatching} onCopy={copy} />
                    ))}
                  </ol>
                  {facing.hasMore && (
                    <button
                      type="button"
                      onClick={() => runFacing(facing.query, { append: true })}
                      disabled={facing.loadingMore}
                      className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand-navy/15 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-sky disabled:opacity-60"
                    >
                      {facing.loadingMore ? "Finding more…" : "Show 10 more"}
                    </button>
                  )}
                </div>
              )}
            </div>
          {/* Themes — a tag filter, not a search (CLAUDE.md rule 2). The chip
              row stays pinned while the list below it scrolls. */}
          <div className="sticky top-0 z-10 -mx-3 mt-8 bg-white/95 px-3 py-3 backdrop-blur sm:-mx-8 sm:px-8">
            <div role="group" aria-label="Themes" className="fh-no-scrollbar flex snap-x gap-2 overflow-x-auto">
              {THEMES.map((t) => {
                const on = t.slug === theme;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={(e) => {
                      pickTheme(t.slug);
                      e.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
                    }}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex h-10 flex-shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors active:scale-95",
                      on
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-brand-navy/15 bg-white text-brand-ink hover:border-brand-navy/50"
                    )}
                  >
                    {t.name}
                    {counts[t.slug] != null && (
                      <span className={cn("text-xs font-normal tabular-nums", on ? "text-white/70" : "text-brand-gray")}>
                        {counts[t.slug].toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <section
              aria-labelledby="theme-heading"
              className="fh-rise rounded-[1.75rem] border border-brand-navy/10 bg-white p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-brand-gray">{themeInfo.sub}</p>
                  <h2 id="theme-heading" className="mt-1 font-display text-4xl font-medium tracking-tight text-brand-ink">
                    {themeInfo.name}
                  </h2>
                  {counts[theme] != null && (
                    <p className="mt-1 text-sm text-brand-gray">{counts[theme].toLocaleString()} declarations from the messages</p>
                  )}
                </div>
                <Button
                  variant="dark"
                  size="sm"
                  icon={false}
                  onClick={() => openSpeak("theme")}
                  disabled={!themeItems?.length}
                  className="py-2.5 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  Speak these
                </Button>
              </div>

              {themeItems === null ? (
                <div aria-hidden="true" className="mt-6 space-y-5">
                  {[92, 76, 88, 70].map((w) => (
                    <div key={w} className="h-6 rounded-full bg-brand-sky motion-safe:animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : themeItems.length ? (
                <ol key={theme} className="fh-stagger mt-4 divide-y divide-brand-navy/10 border-t border-brand-navy/10">
                  {themeItems.map((d, i) => (
                    <DeclarationLine key={d.id || i} declaration={d} index={i} onWatch={setWatching} onCopy={copy} />
                  ))}
                </ol>
              ) : (
                <p className="mt-6 text-base text-brand-gray">These declarations couldn&rsquo;t load just now. Try again in a moment.</p>
              )}

              <Link
                href={`/declarations/${theme}`}
                className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy"
              >
                {counts[theme] != null ? `See all ${counts[theme].toLocaleString()} on ${themeInfo.name}` : `See all on ${themeInfo.name}`}
                <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </section>

            {/* My declarations + streak */}
            <section
              aria-labelledby="mine-heading"
              className="fh-rise flex flex-col gap-4 rounded-[1.75rem] border border-brand-navy/10 bg-brand-sky/50 p-5 sm:p-6"
              style={{ "--i": 1 }}
            >
              <div className="min-w-0">
                <h2 id="mine-heading" className="font-display text-2xl font-medium text-brand-ink">
                  My declarations
                </h2>
                <p className="mt-2 text-sm text-brand-gray">
                  {saved.length
                    ? `${saved.length} saved to speak each day`
                    : "Tap the bookmark on any declaration to keep it here"}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy">
                  <Flame size={14} aria-hidden="true" />
                  {streakLabel(streak)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {saved.length > 0 && (
                  <Button variant="dark" size="sm" icon={false} onClick={() => openSpeak("mine")} className="py-2.5">
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                    Speak them
                  </Button>
                )}
                <Button href="/declarations/mine" variant="quiet" size="sm" className="py-2.5">
                  {saved.length ? "Open" : "See how it works"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
