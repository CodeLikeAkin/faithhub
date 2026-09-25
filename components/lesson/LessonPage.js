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
import { DotGrid } from "@/components/Decor";
import LessonPlayer from "./LessonPlayer";
import CourseOutline, { partDate } from "./CourseOutline";
import AskPanel from "./AskPanel";
import Section from "./Section";
import { useSeriesBundle } from "./useSeriesBundle";
import { cleanTitle, parseTitle, partTitle, seriesName } from "@/lib/titles";
import { scrollToElement } from "@/lib/scroll";
import { useMediaQuery, PANEL_DOCKED_QUERY } from "@/lib/useMediaQuery";
import { recordLastLesson } from "@/lib/recent";

const DECL_PREVIEW = 5;

const NOTES_MARKDOWN = {
  h1: ({ node, ...props }) => <h3 className="mb-2 mt-8 font-display text-2xl font-medium text-brand-ink first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h3 className="mb-2 mt-8 font-display text-2xl font-medium text-brand-ink first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h4 className="mb-2 mt-6 font-display text-xl font-medium text-brand-ink first:mt-0" {...props} />,
  p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-brand-ink" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-4 list-disc space-y-2 pl-6 marker:text-brand-navy/50" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-brand-navy/70" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-5 rounded-r-2xl border-l-2 border-brand-navy/40 bg-brand-sky/50 py-3 pl-5 pr-4 font-display text-lg italic text-brand-ink" {...props} />
  ),
};

function LessonSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-4xl px-0 pt-0 sm:px-8 sm:pt-8">
      <div className="aspect-video w-full bg-brand-sky motion-safe:animate-pulse sm:rounded-[1.5rem]" />
      <div className="px-4 sm:px-0">
        <div className="mt-8 h-4 w-48 rounded-full bg-brand-sky motion-safe:animate-pulse" />
        <div className="mt-4 h-10 w-3/4 rounded-2xl bg-brand-sky motion-safe:animate-pulse" />
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
  const [showAllDecls, setShowAllDecls] = useState(false);
  const [toast, showToast] = useToast();
  const docked = useMediaQuery(PANEL_DOCKED_QUERY);
  const scrollRef = useRef(null);
  const playerRef = useRef(null);

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
  const header = part ? parseTitle(part.title, series?.title) : null;
  const headerDate = part ? partDate(part, { month: "long", day: "numeric", year: "numeric" }) : null;

  const scrollToPlayer = () => {
    if (playerRef.current) scrollToElement(playerRef.current, { offset: 16 });
  };

  const goPart = useCallback(
    (id, t = null) => {
      const p = parts.find((x) => x.id === id);
      if (!p) return;
      setActiveId(id);
      setStartAt(0);
      setShowAllDecls(false);
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

  const sections = pd && !pd.loading
    ? [
        pd.notes && { id: "notes", label: "Notes" },
        pd.scriptures?.length > 0 && { id: "scriptures", label: "Scriptures" },
        pd.wordStudies?.length > 0 && { id: "words", label: "Words" },
        pd.declarations?.length > 0 && { id: "declarations", label: "Declarations" },
      ].filter(Boolean)
    : [];

  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (el) scrollToElement(el, { offset: 56 });
    try {
      window.history.replaceState(null, "", `/sermon/${part.id}#${id}`);
    } catch {
      /* noop */
    }
  };

  // Arriving on /sermon/[id]#scriptures: jump there once the content exists.
  const jumpedToHash = useRef(false);
  useEffect(() => {
    if (jumpedToHash.current || !pd || pd.loading) return;
    jumpedToHash.current = true;
    const id = window.location.hash.slice(1);
    if (["notes", "scriptures", "words", "declarations"].includes(id)) {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) scrollToElement(el, { offset: 56, smooth: false });
      }, 60);
    }
  }, [pd]);

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

  const decls = pd?.declarations || [];
  const shownDecls = showAllDecls ? decls : decls.slice(0, DECL_PREVIEW);

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
            className="hidden xl:inline-flex"
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
            <h1 className="font-display text-3xl font-medium text-brand-ink">We couldn&rsquo;t find that message</h1>
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
                {series && (
                  <p className="text-sm text-brand-gray">
                    <Link href={`/series/${series.id}`} className="font-semibold text-brand-navy hover:underline">
                      {seriesName(series.title)}
                    </Link>
                    {part.part_number && (
                      <>
                        {" "}
                        · Part {part.part_number} of {parts.length}
                      </>
                    )}
                  </p>
                )}
                <h1 className="mt-2 font-display text-2xl font-medium leading-[1.1] tracking-tight text-brand-ink text-balance sm:text-3xl lg:text-4xl">
                  {header.name}
                </h1>
                {header.session && (
                  <p className="mt-4">
                    <span className="inline-flex items-center rounded-full bg-brand-sky px-3 py-1 text-sm font-semibold text-brand-navy">
                      {header.session}
                    </span>
                  </p>
                )}
                {(header.speaker || headerDate) && (
                  <p className="mt-3 text-sm text-brand-gray">{[header.speaker, headerDate].filter(Boolean).join(" · ")}</p>
                )}
                {part.summary && (
                  <p className="mt-5 max-w-2xl text-justify [hyphens:auto] text-lg leading-relaxed text-brand-ink/80">{part.summary}</p>
                )}
              </header>

              {series && parts.length > 1 && (
                <CourseOutline className="mt-9" series={series} parts={parts} activeId={part.id} onSelect={(id) => goPart(id)} />
              )}

              {sections.length > 1 && (
                <nav
                  aria-label="On this page"
                  className="sticky top-0 z-10 -mx-4 mt-10 border-b border-brand-navy/10 bg-white/90 px-4 backdrop-blur sm:-mx-8 sm:px-8"
                >
                  <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sections.map((s) => (
                      <li key={s.id} className="flex-shrink-0">
                        <a
                          href={`#${s.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            jumpTo(s.id);
                          }}
                          className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-brand-ink/75 transition-colors hover:bg-brand-sky hover:text-brand-navy"
                        >
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              {pd?.loading && (
                <p className="mt-12 flex items-center gap-3 text-sm text-brand-gray">
                  <Loader2 size={16} className="text-brand-navy motion-safe:animate-spin" aria-hidden="true" />
                  Gathering the notes, scriptures and declarations…
                </p>
              )}

              {pd && !pd.loading && !pd.notes && (
                <p className="mt-12 rounded-[1.5rem] bg-brand-light px-6 py-5 text-sm leading-relaxed text-brand-gray">
                  {sections.length === 0
                    ? "Notes, scriptures and declarations for this message are still being prepared. You can already ask about it — every answer comes from what was preached."
                    : "Notes for this message haven’t been written yet. Everything below is drawn from the message itself, and you can ask about any of it."}
                </p>
              )}

              {pd?.notes && (
                <Section id="notes" title="Notes" intro="As if you sat in the service with a notebook open">
                  <div className="max-w-2xl text-justify [hyphens:auto] text-base leading-[1.8] text-brand-ink/90 lg:text-lg lg:leading-[1.75]">
                    <ReactMarkdown components={NOTES_MARKDOWN}>{pd.notes}</ReactMarkdown>
                  </div>
                </Section>
              )}

              {pd?.scriptures?.length > 0 && (
                <Section
                  id="scriptures"
                  title="Scriptures in this message"
                  intro={`${pd.scriptures.length} readings. Tap one to read it and see why it was read.`}
                >
                  <VerseExplorer sermonId={part.id} scriptures={pd.scriptures} embedded />
                </Section>
              )}

              {pd?.wordStudies?.length > 0 && (
                <Section id="words" title="Words he explained" intro="The Greek and Hebrew behind the message. Tap a word.">
                  <WordStudy sermonId={part.id} words={pd.wordStudies} embedded onWatch={playMoment} />
                </Section>
              )}

              {decls.length > 0 && (
                <Section id="declarations" title="Declarations from this message" intro="Speak them over your life">
                  <ul className="divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                    {shownDecls.map((d) => (
                      <DeclarationLine
                        key={d.id}
                        declaration={{ ...d, sermon_id: part.id, sermon_title: part.title }}
                        onWatch={playMoment}
                        onCopy={(text) => copyText(text, showToast)}
                        showSource={false}
                      />
                    ))}
                  </ul>
                  {decls.length > DECL_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setShowAllDecls((v) => !v)}
                      className="mt-4 text-sm font-semibold text-brand-navy hover:underline"
                    >
                      {showAllDecls ? "Show fewer" : `Show all ${decls.length}`}
                    </button>
                  )}
                </Section>
              )}

              {next && (
                <button
                  type="button"
                  onClick={() => goPart(next.id)}
                  className="group relative mt-16 flex w-full items-center gap-4 overflow-hidden rounded-[1.75rem] bg-brand-deep p-4 text-left text-white sm:gap-5 sm:p-5"
                >
                  <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_right,black,transparent_70%)]" />
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
                    <span className="block text-sm text-white/70">Up next · Part {next.part_number}</span>
                    {/* No `block` beside line-clamp-* — it overrides the -webkit-box
                        display the clamp needs, and the text spills instead of clamping. */}
                    <span className="mt-1 line-clamp-2 font-display text-xl font-medium leading-snug sm:text-2xl">
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
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-20 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand-navy/30 transition-colors hover:bg-brand-deep xl:hidden"
        >
          <Sparkles size={16} aria-hidden="true" />
          Ask about this message
        </button>
      )}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
