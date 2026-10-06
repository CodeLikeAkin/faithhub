"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import ToolShell, { HeaderButton } from "@/components/shell/ToolShell";
import { copyText, useToast } from "@/components/shell/Toast";
import DeclarationLine from "@/components/declarations/DeclarationLine";
import VideoModal from "@/components/VideoModal";
import VerseExplorer from "@/components/VerseExplorer";
import WordStudy from "@/components/WordStudy";
import { DotGrid, QuoteGlyph, Rings } from "@/components/Decor";
import LessonPlayer from "./LessonPlayer";
import CourseOutline, { partDate } from "./CourseOutline";
import AskPanel from "./AskPanel";
import Section from "./Section";
import { useSeriesBundle } from "./useSeriesBundle";
import { cleanTitle, parseTitle, partTitle, seriesName } from "@/lib/titles";
import { scrollToElement } from "@/lib/scroll";
import { useMediaQuery, PANEL_DOCKED_QUERY } from "@/lib/useMediaQuery";
import { recordLastLesson } from "@/lib/recent";
import { cn } from "@/lib/utils";

/** One tab's contents. Only the open one is ever in the document. */
function TabPanel({ id, children }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={-1}>
      {children}
    </div>
  );
}

// Set in the Vision page's reading style: medium-weight display headings,
// navy diamonds for bullets, and quotes as its pull quote (sky gradient, a
// navy-to-mist bar down the left, a faint quote mark in the corner).
const NOTES_MARKDOWN = {
  h1: ({ node, ...props }) => <h3 className="mb-3 mt-10 font-display text-2xl font-medium tracking-tight text-brand-ink first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h3 className="mb-3 mt-10 font-display text-2xl font-medium tracking-tight text-brand-ink first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h4 className="mb-2 mt-7 font-display text-xl font-medium text-brand-navy first:mt-0" {...props} />,
  p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-brand-ink" {...props} />,
  ul: ({ node, ...props }) => (
    <ul
      className="my-4 space-y-2.5 pl-1 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0.5 [&>li]:before:top-[0.72em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rotate-45 [&>li]:before:bg-brand-navy [&>li]:before:content-['']"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => <ol className="my-4 list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-brand-navy" {...props} />,
  blockquote: ({ node, children, ...props }) => (
    <blockquote
      className="relative isolate my-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-sky to-brand-sky/40 py-4 pl-6 pr-12 font-display text-lg italic leading-snug text-brand-ink sm:py-5 sm:pl-8 sm:text-xl [&_p]:mb-0"
      {...props}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-navy to-brand-mist" />
      <QuoteGlyph className="absolute right-4 top-4 -z-10 h-6 w-8 text-brand-navy/15" />
      {children}
    </blockquote>
  ),
};

// Some generated notes put a quote mid-line as `… text. > "quote"`; markdown
// only reads ">" at the start of a line, so it showed as a stray character.
const tidyNotes = (md) => md.replace(/([^\n>])[ \t]+>[ \t]+(?=["“'‘])/g, "$1 ");

function LessonSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-4xl px-0 pt-0 sm:px-8 sm:pt-8">
      <div className="aspect-video w-full fh-skeleton sm:rounded-[1.5rem]" />
      <div className="px-4 sm:px-0">
        <div className="mt-8 h-4 w-48 rounded-full fh-skeleton" />
        <div className="mt-4 h-10 w-3/4 rounded-2xl fh-skeleton" />
        <div className="mt-8 h-40 rounded-[1.5rem] bg-brand-sky/60 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/**
 * /sermon/[id] — a message as a lesson: its video plays at the top, the
 * series sits beside it as a numbered course, and everything drawn from the
 * message (notes, scriptures, word studies, declarations) follows as one
 * continuous page. Asking happens in the side panel; a cited moment from this
 * series seeks the player instead of opening YouTube.
 */
export default function LessonPage({ sermonId }) {
  const entry = useMemo(() => ({ type: "sermon", sermonId }), [sermonId]);
  const { loading, notFound, series, parts, partData, loadPartData } = useSeriesBundle(entry);

  const [activeId, setActiveId] = useState(sermonId);
  const [panelOpen, setPanelOpen] = useState(null); // null → docked from xl, closed below
  const [seek, setSeek] = useState(null); // { videoId, t, n }
  const [startAt, setStartAt] = useState(0);
  const [watching, setWatching] = useState(null); // moments outside this series → modal
  const [tab, setTab] = useState(null); // the open panel; null until the data says which exist
  const [toast, showToast] = useToast({ offset: "5.5rem" }); // clears the Ask button
  const docked = useMediaQuery(PANEL_DOCKED_QUERY);
  const scrollRef = useRef(null);
  const playerRef = useRef(null);
  const tabsRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => setActiveId(sermonId), [sermonId]);

  // ?t=<seconds> starts the player there.
  useEffect(() => {
    const t = parseInt(new URLSearchParams(window.location.search).get("t") || "", 10);
    if (t > 0) setStartAt(t);
  }, []);

  const part = parts.find((p) => p.id === activeId) || parts[0] || null;
  const pd = part ? partData[part.id] : null;
  const idx = part ? parts.indexOf(part) : -1;
  const next = idx >= 0 ? parts[idx + 1] || null : null;
  // A part's own name within its series ("Day One Morning", not the event name every part shares).
  const nameOf = (p) => (series ? partTitle(p.title, series.title) : cleanTitle(p.title));

  // The header splits the title into its own slots: name, event session, speaker · date.
  // All three meet on one byline under the title, so the date stays short enough
  // not to wrap it at phone width ("2 Sep 2026", not "September 2, 2026").
  const header = part ? parseTitle(part.title, series?.title) : null;
  const headerDate = part ? partDate(part, { day: "numeric", month: "short", year: "numeric" }, "en-GB") : null;
  // The session arrives pre-joined ("Day 1 · Morning"); on one byline its own
  // separator would read as two more fields, so it travels as a single phrase.
  const byline = [header?.speaker, headerDate, header?.session?.replace(/\s*·\s*/g, " ")].filter(Boolean).join(" · ");

  const scrollToPlayer = () => {
    if (playerRef.current) scrollToElement(playerRef.current, { offset: 16 });
  };

  const goPart = useCallback(
    (id, t = null) => {
      const p = parts.find((x) => x.id === id);
      if (!p) return;
      setActiveId(id);
      setStartAt(0);
      loadPartData(id);
      try {
        window.history.replaceState(null, "", `/sermon/${id}`);
      } catch {
        /* noop */
      }
      if (t != null) {
        setSeek({ videoId: p.youtube_video_id, t, n: Date.now() });
        scrollToPlayer();
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
      }
    },
    [parts, loadPartData]
  );

  // A cited moment (from the Ask panel, a declaration, a word study): play
  // it here if it's in this series, else in the modal.
  const playMoment = (seg) => {
    const p = seg?.video_id ? parts.find((x) => x.youtube_video_id === seg.video_id) : null;
    if (!p) {
      setWatching(seg);
      return;
    }
    if (!docked && panelOpen === true) setPanelOpen(null); // close the sheet so the video shows
    if (p.id !== part?.id) {
      goPart(p.id, seg.start_seconds || 0);
      return;
    }
    setSeek({ videoId: p.youtube_video_id, t: seg.start_seconds || 0, n: Date.now() });
    scrollToPlayer();
  };

  const describeMoment = (seg) => {
    const p = parts.find((x) => x.youtube_video_id && x.youtube_video_id === seg.video_id);
    if (!p) return null;
    if (p.id === part?.id) return "This message";
    return p.part_number ? `Part ${p.part_number} · ${nameOf(p)}` : nameOf(p);
  };

  const context = useMemo(() => {
    if (!part) return null;
    return series
      ? {
          seriesId: series.id,
          seriesTitle: series.title,
          sermonId: part.id,
          sermonTitle: partTitle(part.title, series.title),
          partNumber: part.part_number,
        }
      : { sermonId: part.id, sermonTitle: cleanTitle(part.title) };
  }, [series, part]);

  // Everything drawn from the message is a tab, not a stretch of one long
  // page: only the open panel is in the document, so reading the
  // declarations never means scrolling past the notes to reach them.
  const tabs = pd && !pd.loading
    ? [
        pd.notes && { id: "notes", label: "Notes" },
        pd.scriptures?.length > 0 && { id: "scriptures", label: "Scriptures", count: pd.scriptures.length },
        pd.wordStudies?.length > 0 && { id: "words", label: "Words", count: pd.wordStudies.length },
        pd.declarations?.length > 0 && { id: "declarations", label: "Declarations", count: pd.declarations.length },
      ].filter(Boolean)
    : [];
  const tabKey = tabs.map((t) => t.id).join();

  const openTab = (id) => {
    setTab(id);
    // A panel replaces its predecessor, so reading to the foot of a long one
    // and switching would otherwise open the next already scrolled past its
    // own heading. Anchor on the panel, not the tab bar: the bar is sticky, so
    // it always measures as visible and would never move anything. Scroll up
    // only — tapping a tab from the top of the page must not pull the player
    // off screen.
    requestAnimationFrame(() => {
      const box = scrollRef.current;
      const el = panelRef.current;
      if (!box || !el) return;
      const bar = tabsRef.current?.offsetHeight || 0;
      const delta = el.getBoundingClientRect().top - (box.getBoundingClientRect().top + bar);
      if (delta < 0) box.scrollTo({ top: box.scrollTop + delta, behavior: "smooth" });
    });
    try {
      window.history.replaceState(null, "", `/sermon/${part.id}#${id}`);
    } catch {
      /* noop */
    }
  };

  // Settle on a tab once the data says which exist: the one in the URL if it
  // has content, else the first. Re-runs per message, since parts differ in
  // what they carry.
  useEffect(() => {
    if (!tabKey) return;
    const ids = tabKey.split(",");
    const wanted = decodeURIComponent(window.location.hash.slice(1));
    setTab((t) => (t && ids.includes(t) ? t : ids.includes(wanted) ? wanted : ids[0]));
  }, [tabKey, part?.id]);

  // Remember this lesson for the home page's "Pick up where you left off".
  useEffect(() => {
    if (loading || !part) return;
    recordLastLesson({
      kind: "lesson",
      href: `/sermon/${part.id}`,
      title: nameOf(part),
      seriesId: series?.id || null,
      seriesTitle: series?.title || null,
      partNumber: part.part_number || null,
      parts: parts.length,
      videoId: part.youtube_video_id || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, part?.id, series?.id]);

  const pageTitle = part ? `${nameOf(part)} · ${series ? seriesName(series.title) : "FaithHub"}` : "FaithHub";
  useEffect(() => {
    if (document.title !== pageTitle) document.title = pageTitle;
  });

  const panelShown = panelOpen ?? docked;
  const sheetShown = panelOpen === true && !docked;

  // A study from the rail that belongs here opens in the panel; anything
  // else follows its link to the full /ask page.
  const [panelStudy, setPanelStudy] = useState(null);
  const openStudyHere = (study) => {
    if (!context || !study.context) return false;
    const mine = context.seriesId
      ? study.context.seriesId === context.seriesId
      : !study.context.seriesId && study.context.sermonId === context.sermonId;
    if (!mine) return false;
    setPanelStudy({ id: study.id, at: Date.now() });
    setPanelOpen(true);
    return true;
  };

  const panel =
    context && !loading && !notFound ? (
      <AskPanel
        context={context}
        openStudy={panelStudy}
        defaultScopeType="message"
        suggestions={Array.isArray(series?.suggested_questions) ? series.suggested_questions : []}
        hasPlayer
        onCite={playMoment}
        onClose={() => setPanelOpen(false)}
        describeMoment={describeMoment}
      />
    ) : null;

  // On a phone the tab bar carries the Ask button, so the floating one only
  // appears there when there is no tab bar (and from sm up, where it has room).
  const askInNav = Boolean(panel) && tabs.length > 1;

  return (
    <ToolShell
      kind="lesson"
      back={<Link href="/series" className="hover:text-brand-navy">Series Study</Link>}
      title={series ? seriesName(series.title) : part ? cleanTitle(part.title) : ""}
      titleAs="p"
      actions={
        panel ? (
          <HeaderButton
            icon={Sparkles}
            label={panelShown ? "Hide Ask" : "Ask"}
            aria-pressed={panelShown}
            onClick={() => setPanelOpen(!panelShown)}
            className="hidden lg:inline-flex"
          />
        ) : null
      }
      panel={panel}
      panelOpen={panelOpen}
      onPanelOpenChange={setPanelOpen}
      panelLabel="Ask about this message"
      onOpenStudy={openStudyHere}
      overlay={toast}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <LessonSkeleton />
        ) : notFound || !part ? (
          <div className="mx-auto max-w-xl px-6 py-24 text-center">
            <h1 className="font-display text-2xl font-semibold text-brand-ink">We couldn&rsquo;t find that message</h1>
            <p className="mt-3 text-brand-gray">It may have been moved, or the link is incomplete.</p>
            <Link
              href="/series"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-bold text-white hover:bg-brand-deep"
            >
              Browse the series <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl pb-32 sm:px-8 sm:pt-8">
            <div ref={playerRef}>
              <LessonPlayer videoId={part.youtube_video_id} title={part.title} startAt={startAt} seek={seek} />
            </div>

            <div className="px-4 sm:px-0">
              <header className="mt-6 sm:mt-8">
                {/* Set as the Vision eyebrow (rule + caps); the series name is
                    still the way back to the course. */}
                {series && (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-navy">
                    <span aria-hidden="true" className="h-px w-8 bg-brand-navy/40" />
                    <Link href={`/series/${series.id}`} className="hover:underline">
                      {seriesName(series.title)}
                    </Link>
                    {part.part_number && header.named && (
                      <span className="text-brand-gray">
                        Part {part.part_number} of {parts.length}
                      </span>
                    )}
                  </p>
                )}
                <h1 className="mt-3 font-display text-2xl font-medium leading-[1.1] tracking-tight text-brand-ink text-pretty sm:text-3xl">
                  {header.named || !series || !part.part_number ? header.name : `Part ${part.part_number}`}
                </h1>
                {byline && <p className="mt-2 text-sm text-brand-gray sm:mt-3">{byline}</p>}
                {part.summary && (
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-ink/80 sm:mt-5 sm:text-lg">{part.summary}</p>
                )}
              </header>

              {tabs.length > 1 && (
                <div
                  ref={tabsRef}
                  className="sticky top-0 z-10 -mx-4 mt-5 flex items-center border-b border-brand-navy/10 bg-white/95 pl-4 backdrop-blur sm:-mx-8 sm:mt-10 sm:px-8"
                >
                  <div className="relative min-w-0 flex-1">
                    <div
                      role="tablist"
                      aria-label="What's in this message"
                      className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {tabs.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="tab"
                          id={`tab-${t.id}`}
                          aria-selected={tab === t.id}
                          aria-controls={`panel-${t.id}`}
                          onClick={() => openTab(t.id)}
                          className={cn(
                            "relative inline-flex h-11 flex-shrink-0 items-center gap-1.5 px-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full",
                            tab === t.id ? "text-brand-navy after:bg-brand-navy" : "text-brand-ink/70 hover:text-brand-navy"
                          )}
                        >
                          {t.label}
                          {t.count != null && <span className="text-xs font-normal text-brand-gray">{t.count}</span>}
                        </button>
                      ))}
                    </div>
                    {/* Tells a phone reader the tabs scroll sideways. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:hidden"
                    />
                  </div>
                  {askInNav && (
                    <button
                      type="button"
                      onClick={() => setPanelOpen(true)}
                      aria-label="Ask about this message"
                      className="mx-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand-navy text-white transition-colors hover:bg-brand-deep sm:hidden"
                    >
                      <Sparkles size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              {pd?.loading && (
                <p className="mt-12 flex items-center gap-3 text-sm text-brand-gray">
                  <Loader2 size={16} className="text-brand-navy motion-safe:animate-spin" aria-hidden="true" />
                  Gathering the notes, scriptures and declarations…
                </p>
              )}

              {pd && !pd.loading && !pd.notes && (
                <p className="mt-12 rounded-[1.5rem] bg-brand-light px-6 py-5 text-sm leading-relaxed text-brand-gray">
                  {tabs.length === 0
                    ? "Notes, scriptures and declarations for this message are still being prepared. You can already ask about it — every answer comes from what was preached."
                    : "Notes for this message haven’t been written yet. Everything below is drawn from the message itself, and you can ask about any of it."}
                </p>
              )}

              {/* One panel at a time. Each is keyed so switching tabs remounts
                  its contents rather than carrying the last one's state over. */}
              <div ref={panelRef}>
              {tab === "notes" && pd?.notes && (
                <TabPanel id="notes">
                  <Section id="notes-sec" eyebrow="From the service" title="Notes" titleHidden flush intro="The key points of the message, with the scriptures behind each one">
                    <div className="max-w-2xl text-base leading-[1.75] text-brand-ink/90 lg:text-lg">
                      <ReactMarkdown components={NOTES_MARKDOWN}>{tidyNotes(pd.notes)}</ReactMarkdown>
                    </div>
                  </Section>
                </TabPanel>
              )}

              {tab === "scriptures" && pd?.scriptures?.length > 0 && (
                <TabPanel id="scriptures">
                  <Section
                    id="scriptures-sec"
                    eyebrow="Read in this message"
                    title="Scriptures in this message"
                    titleHidden
                    flush
                    intro={`${pd.scriptures.length} readings. Tap one to read it and see why it was read.`}
                  >
                    <VerseExplorer key={part.id} sermonId={part.id} scriptures={pd.scriptures} embedded />
                  </Section>
                </TabPanel>
              )}

              {tab === "words" && pd?.wordStudies?.length > 0 && (
                <TabPanel id="words">
                  <Section
                    id="words-sec"
                    eyebrow="Greek & Hebrew"
                    title="Words he explained"
                    titleHidden
                    flush
                    intro="The Greek and Hebrew behind the message. Tap a word."
                  >
                    <WordStudy key={part.id} sermonId={part.id} words={pd.wordStudies} embedded onWatch={playMoment} />
                  </Section>
                </TabPanel>
              )}

              {tab === "declarations" && pd?.declarations?.length > 0 && (
                <TabPanel id="declarations">
                  <Section id="declarations-sec" eyebrow="To declare" title="Declarations from this message" titleHidden flush intro="Speak them over your life">
                    <ul className="divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                      {pd.declarations.map((d) => (
                        <DeclarationLine
                          key={d.id}
                          declaration={{ ...d, sermon_id: part.id, sermon_title: part.title }}
                          onWatch={playMoment}
                          onCopy={(text) => copyText(text, showToast)}
                          showSource={false}
                        />
                      ))}
                    </ul>
                  </Section>
                </TabPanel>
              )}
              </div>

              {/* Where to go next in the series: page furniture, the same under
                  every tab, so it sits at the foot rather than above the content. */}
              {series && parts.length > 1 && (
                <CourseOutline className="mt-16" series={series} parts={parts} activeId={part.id} onSelect={(id) => goPart(id)} />
              )}

              {next && (
                <button
                  type="button"
                  onClick={() => goPart(next.id)}
                  className="group relative isolate mt-4 flex w-full items-center gap-4 overflow-hidden rounded-[1.75rem] bg-brand-deep p-4 text-left text-white shadow-card transition-shadow hover:shadow-lift sm:gap-5 sm:p-5"
                >
                  {/* The Vision page's dark panel, in miniature. */}
                  <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-brand-navy blur-3xl" />
                  <DotGrid dark className="inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_right,black,transparent_70%)]" />
                  <Rings className="pointer-events-none absolute -bottom-32 -right-24 -z-10 h-72 w-72 text-white/[0.07]" />
                  <span className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-xl bg-brand-navy sm:w-44">
                    {next.youtube_video_id && (
                      <img
                        src={`https://img.youtube.com/vi/${next.youtube_video_id}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                      />
                    )}
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                      <span aria-hidden="true" className="h-px w-6 bg-white/40" />
                      Up next · Part {next.part_number}
                    </span>
                    {/* No `block` beside line-clamp-* — it overrides the -webkit-box
                        display the clamp needs, and the text spills instead of clamping. */}
                    <span className="mt-2 line-clamp-2 font-display text-xl font-medium leading-snug sm:text-2xl">
                      {nameOf(next)}
                    </span>
                  </span>
                  <ArrowRight
                    size={22}
                    aria-hidden="true"
                    className="relative flex-shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {panel && !sheetShown && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Ask about this message"
          /* Icon-only on a phone: the labelled pill ran half the width of the
             screen and sat on top of the notes you were reading. The label
             comes back where there's room for it. */
          className={cn(
            "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-20 h-14 w-14 items-center justify-center gap-2 rounded-full bg-brand-navy text-sm font-bold text-white shadow-xl shadow-brand-navy/30 transition-colors hover:bg-brand-deep sm:inline-flex sm:h-auto sm:w-auto sm:px-5 sm:py-3.5 lg:hidden",
            askInNav ? "hidden" : "inline-flex"
          )}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Ask about this message</span>
        </button>
      )}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
