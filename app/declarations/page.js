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
  dayNumber,
  fetchThemeForDay,
  themeBySlug,
  themeOfDay,
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
import { DotGrid, Eyebrow, QuoteGlyph, Rings } from "@/components/Decor";

/**
 * Declarations — a library of declarations from Heritage of Faith messages to speak.
 *
 *   /declarations                     "What are you facing?" + today's declaration (navy
 *                                     masthead), theme chips led by today's theme with
 *                                     that theme's 8 for the day in place (same for
 *                                     everyone, new each day — lib/declarations.js
 *                                     fetchThemeForDay), My declarations
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
  const [facing, setFacing] = useState(null); // { query, status, response, items, hasMore, loadingMore, error }
  const [speak, setSpeak] = useState(null); // { key, title, items }
  const [watching, setWatching] = useState(null);
  const [toast, showToast] = useToast();
  const saved = useSavedDeclarations();
  const streak = useStreak();
  const resultsRef = useRef(null);
  // The day (Lagos calendar) and the theme leading it are set on the client:
  // a server render near midnight could disagree and break hydration.
  const [day, setDay] = useState(null);
  const [todayTheme, setTodayTheme] = useState(null);
  const [theme, setTheme] = useState(null); // null until the day is known
  const [themeItems, setThemeItems] = useState(null); // null = loading
  const themeInfo = themeBySlug(theme) || themeBySlug(todayTheme) || THEMES[0];

  // The open theme's 8 for today — a topic_tags filter (CLAUDE.md rule 2),
  // the same 8 for everyone, new ones tomorrow.
  useEffect(() => {
    if (!theme || day == null) return;
    let live = true;
    setThemeItems(null);
    fetchThemeForDay(theme, day)
      .then((items) => live && setThemeItems(items))
      .catch(() => live && setThemeItems([]));
    return () => {
      live = false;
    };
  }, [theme, day]);

  const pickTheme = (slug) => {
    setTheme(slug);
    setParams({ theme: slug === todayTheme ? null : slug });
  };

  // Today's theme leads the chip row; the rest keep their usual order.
  const chipThemes = todayTheme
    ? [themeBySlug(todayTheme), ...THEMES.filter((t) => t.slug !== todayTheme)]
    : THEMES;

  useEffect(() => {
    document.title = "Declarations · FaithHub";
    let cancelled = false;
    fetchTodaysDeclaration()
      .then((d) => !cancelled && setToday(d))
      .catch(() => !cancelled && setToday(null));
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
    const d = dayNumber();
    const lead = themeOfDay(d);
    setDay(d);
    setTodayTheme(lead);
    const t = themeBySlug(params.get("theme"));
    setTheme(t ? t.slug : lead);
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
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-3 sm:px-8 sm:pt-8">
          <Masthead
            eyebrow="Declarations"
            title={
              <>
                Speak <em>Life</em>
              </>
            }
            description="Say it plainly. You’ll get declarations from Heritage of Faith messages that speak to it, and a short word for you."
            aside={
              today !== null && (
                <section
                  aria-labelledby="today-heading"
                  className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6"
                >
                  <QuoteGlyph className="pointer-events-none absolute -right-2 top-4 -z-10 h-16 w-24 text-white/[0.035]" />
                  {/* Set like the Eyebrow (rule + caps), kept an h2 for the outline. */}
                  <h2
                    id="today-heading"
                    className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/65"
                  >
                    <span aria-hidden="true" className="h-px w-8 bg-white/40" />
                    Today&rsquo;s declaration
                  </h2>
                  {today === undefined ? (
                    <div aria-hidden="true" className="mt-4 space-y-3">
                      <div className="h-6 w-11/12 rounded-full fh-skeleton-dark" />
                      <div className="h-6 w-2/3 rounded-full fh-skeleton-dark" />
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
                      {/* Icons only, in one row — the same three actions the
                          declaration rows below carry, and the labels wrapped
                          onto two lines on a phone. The names live in the
                          tooltip and for screen readers. */}
                      <div className="mt-4 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => openSpeak("today")}
                          aria-label="Speak today's declaration"
                          title="Speak it"
                          className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-navy transition hover:bg-brand-sky active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <Volume2 className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                        </button>
                        {todayParsed && (
                          <button
                            type="button"
                            onClick={() => setWatching({ ...todayParsed, sermon_title: today.sermon_title })}
                            aria-label="Watch the moment this was preached"
                            title="Watch"
                            className="grid h-11 w-11 place-items-center rounded-full border border-white/40 text-white transition hover:bg-white/10 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          >
                            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSaved(today)}
                          aria-pressed={todaySaved}
                          aria-label={todaySaved ? "Saved — tap to remove" : "Save this declaration"}
                          title={todaySaved ? "Saved" : "Save"}
                          className="grid h-11 w-11 place-items-center rounded-full border border-white/40 text-white transition hover:bg-white/10 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <Bookmark className="h-4 w-4" fill={todaySaved ? "currentColor" : "none"} aria-hidden="true" />
                        </button>
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
                /* "Say it plainly": a need in a sentence or two, not a story. */
                maxLength={300}
              />
            </div>
          </Masthead>

          <div ref={resultsRef} className="w-full scroll-mt-6 text-left">
              {facing?.status === "loading" && (
                <div className="mt-8" role="status">
                  <p className="text-sm font-medium text-brand-gray">Finding declarations for you…</p>
                  <div aria-hidden="true" className="mt-5 space-y-5">
                    {[88, 72, 94].map((w) => (
                      <div key={w} className="h-6 rounded-full fh-skeleton" style={{ width: `${w}%` }} />
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
                      /* The Vision page's pull quote: sky gradient, a navy-to-mist
                         bar down the left, a faint quote mark in the corner. */
                      <div className="relative isolate mt-3 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-brand-sky to-brand-sky/40 py-5 pl-6 pr-6 sm:py-6 sm:pl-8 sm:pr-14">
                        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-navy to-brand-mist" />
                        <QuoteGlyph className="absolute right-4 top-4 -z-10 h-6 w-8 text-brand-navy/15" />
                        <Eyebrow>A word for you</Eyebrow>
                        <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-brand-ink/90">{facing.response}</p>
                      </div>
                    ))}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-3xl font-medium tracking-tight text-brand-ink">Declarations to speak</h3>
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
              {chipThemes.map((t) => {
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
                    {/* No counts: nobody reads 3,000 declarations. The chip
                        only says which theme leads today. */}
                    {t.slug === todayTheme && (
                      <span className={cn("text-xs font-normal", on ? "text-white/70" : "text-brand-gray")}>Today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* The Vision backdrop, anchored to the cards rather than the top of
              the page (a "facing" answer above pushes them down): a sky wash
              running full width behind them, and dot grids out in the side
              gutters on wide screens. The declarations themselves stay on
              their white card. */}
          <div className="relative isolate mt-3 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div aria-hidden="true" className="pointer-events-none absolute -inset-x-[50vw] -bottom-24 -top-4 -z-10 bg-gradient-to-b from-white via-brand-sky/70 to-white" />
            <DotGrid className="right-full top-10 -z-10 mr-6 hidden h-[30rem] w-[22rem] [mask-image:radial-gradient(circle_at_left,black,transparent_70%)] xl:block" />
            <DotGrid className="left-full top-64 -z-10 ml-6 hidden h-[30rem] w-[22rem] [mask-image:radial-gradient(circle_at_right,black,transparent_70%)] xl:block" />
            <section
              aria-labelledby="theme-heading"
              className="fh-rise rounded-[1.75rem] border border-brand-navy/10 bg-white p-5 shadow-card sm:p-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <Eyebrow>{themeInfo.sub}</Eyebrow>
                  <h2 id="theme-heading" className="mt-3 font-display text-3xl font-medium tracking-tight text-brand-ink sm:text-4xl">
                    {themeInfo.name}
                  </h2>
                  {theme && (
                    <p className="mt-1 text-sm text-brand-gray">
                      {theme === todayTheme ? "Today’s theme · " : ""}8 to speak today, new ones tomorrow
                    </p>
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
                    <div key={w} className="h-6 rounded-full fh-skeleton" style={{ width: `${w}%` }} />
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
                href={`/declarations/${themeInfo.slug}`}
                className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy"
              >
                See every declaration on {themeInfo.name}
                <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </section>

            {/* My declarations + streak */}
            <section
              aria-labelledby="mine-heading"
              className="fh-rise relative isolate flex flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-brand-navy/10 bg-gradient-to-br from-white to-brand-sky p-5 shadow-card sm:p-6"
              style={{ "--i": 1 }}
            >
              <Rings className="pointer-events-none absolute -bottom-24 -right-24 -z-10 h-64 w-64 text-brand-navy/[0.08]" />
              <div className="min-w-0">
                <Eyebrow>Your set</Eyebrow>
                <h2 id="mine-heading" className="mt-3 font-display text-2xl font-medium tracking-tight text-brand-ink">
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
