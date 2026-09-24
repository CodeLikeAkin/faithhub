"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bookmark, Flame, Play, RotateCcw, Volume2 } from "lucide-react";
import ToolShell from "@/components/shell/ToolShell";
import { copyText, useToast } from "@/components/shell/Toast";
import Composer from "@/components/ask/Composer";
import Button from "@/components/Button";
import VideoModal from "@/components/VideoModal";
import { Rings } from "@/components/Decor";
import DeclarationLine from "@/components/declarations/DeclarationLine";
import SpeakMode from "@/components/declarations/SpeakMode";
import {
  THEMES,
  fetchThemeCount,
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
 *   /declarations                     today's declaration, "What are you facing?", themes
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
    };
    const set = sets[key];
    if (!set) return;
    setSpeak({ key, ...set });
    if (key !== "facing") setParams({ speak: key });
  };

  const closeSpeak = () => {
    setSpeak(null);
    setParams({ speak: null });
  };

  // Deep links: ?facing= asks once; ?speak= opens once its set exists.
  const handledParams = useRef({ facing: false, speak: false });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
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
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 sm:px-8">
          {today === null && (
            <h1 className="pt-12 font-display text-5xl font-medium tracking-tight text-brand-ink">Declarations</h1>
          )}

          {/* Speak Life — shown first so user can ask before seeing today's declaration */}
          <section aria-labelledby="facing-heading" className="pt-10 flex flex-col items-center text-center">
            <h2 id="facing-heading" className="font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">
              Speak Life
            </h2>
            <p className="mt-2 max-w-2xl text-base text-brand-gray">
              Say it plainly. You&rsquo;ll get declarations from Rev. Peter&rsquo;s messages that speak to it, and
              a short word for you.
            </p>
            <div className="mt-6 w-full">
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
          </section>

          {/* Today's declaration — shown below the ask prompt */}
          {today !== null && (
            <section
              aria-labelledby="today-heading"
              className="relative mt-10 overflow-hidden rounded-[1.5rem] bg-black px-6 pb-10 pt-11 text-white sm:rounded-[2rem] sm:px-12 sm:pb-14 sm:pt-16 lg:px-16"
            >
              {/* Brush edges only (top/bottom slices of the art) so the card can be short without cropping them away */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 aspect-[1717/80] min-h-6">
                <Image
                  src="/declaration-bg-wide.webp"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 960px, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 aspect-[1717/80] min-h-6">
                <Image
                  src="/declaration-bg-wide.webp"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 960px, 100vw"
                  className="object-cover object-bottom"
                />
              </div>
              <div className="relative mx-auto max-w-4xl text-center">
                <h2 id="today-heading" className="text-sm text-white/70">
                  Today&rsquo;s declaration
                </h2>
                {today === undefined ? (
                  <div aria-hidden="true" className="mt-4 space-y-3">
                    <div className="mx-auto h-7 w-11/12 rounded-2xl bg-white/10 motion-safe:animate-pulse" />
                    <div className="mx-auto h-7 w-2/3 rounded-2xl bg-white/10 motion-safe:animate-pulse" />
                  </div>
                ) : (
                  <>
                    <blockquote
                      className={cn(
                        "mt-3 font-display font-normal leading-[1.2] tracking-tight text-balance",
                        todayLong ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
                      )}
                    >
                      &ldquo;{today.declaration_text}&rdquo;
                    </blockquote>
                    <div className="mt-4 flex flex-col items-center gap-4">
                      {today.sermon_title && (
                        <p className="min-w-0 text-sm text-white/60">
                          From <span className="font-semibold text-white/85">{cleanTitle(today.sermon_title)}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-center gap-2">
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
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* My declarations + streak */}
          <section
            aria-labelledby="mine-heading"
            className="mt-8 flex flex-col gap-5 rounded-[1.5rem] border border-brand-navy/10 bg-brand-sky/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="min-w-0">
              <h2 id="mine-heading" className="font-display text-2xl font-medium text-brand-ink">
                My declarations
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-gray">
                <span>
                  {saved.length
                    ? `${saved.length} saved to speak each day`
                    : "Tap the bookmark on any declaration to keep it here"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-brand-navy">
                  <Flame size={14} aria-hidden="true" />
                  {streakLabel(streak)}
                </span>
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
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

          {/* Themes */}
          <section aria-labelledby="themes-heading" className="pt-16">
            <h2 id="themes-heading" className="font-display text-3xl font-medium tracking-tight text-brand-ink sm:text-4xl">
              Themes
            </h2>
            <p className="mt-2 text-base text-brand-gray">Every declaration Rev. Peter has given, gathered by what it speaks to.</p>
            <ul className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              {THEMES.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/declarations/${t.slug}`}
                    className="group relative flex h-full min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-brand-navy/10 bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0_24px_50px_-30px_rgba(23,58,104,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    <Rings className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 text-brand-navy/[0.06] transition-colors group-hover:text-brand-navy/[0.12]" />
                    <span className="relative font-display text-2xl font-medium text-brand-ink">{t.name}</span>
                    <span className="relative mt-4 block">
                      <span className="block text-sm leading-snug text-brand-gray">{t.sub}</span>
                      <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-navy">
                        {counts[t.slug] != null ? `${counts[t.slug].toLocaleString()} declarations` : "Open"}
                        <ArrowRight size={12} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
