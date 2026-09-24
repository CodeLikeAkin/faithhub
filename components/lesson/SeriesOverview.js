"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Sparkles } from "lucide-react";
import ToolShell, { HeaderButton } from "@/components/shell/ToolShell";
import { copyText, useToast } from "@/components/shell/Toast";
import DeclarationLine from "@/components/declarations/DeclarationLine";
import VideoModal from "@/components/VideoModal";
import VerseCard, { TranslationToggle } from "@/components/VerseCard";
import { DotGrid, Rings } from "@/components/Decor";
import YtThumb from "@/components/YtThumb";
import AskPanel from "./AskPanel";
import Section from "./Section";
import { partDate } from "./CourseOutline";
import { useSeriesBundle } from "./useSeriesBundle";
import { partTitle, seriesName } from "@/lib/titles";
import { parseScriptureRef } from "@/lib/ask-format";
import { useMediaQuery, PANEL_DOCKED_QUERY } from "@/lib/useMediaQuery";
import { recordLastLesson } from "@/lib/recent";

const DECL_PREVIEW = 6;

const formatDateRange = (start, end) => {
  if (!start) return "";
  const o = { month: "short", year: "numeric" };
  const s = new Date(start).toLocaleDateString("en-US", o);
  const e = end ? new Date(end).toLocaleDateString("en-US", o) : s;
  return s === e ? s : `${s} – ${e}`;
};

const SUMMARY_MARKDOWN = {
  p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-brand-ink" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-4 list-disc space-y-2 pl-6 marker:text-brand-navy/50" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-4 list-decimal space-y-2 pl-6" {...props} />,
};

// A stored key verse carries structured columns; fall back to parsing its label.
const passageFor = (v) =>
  v.chapter
    ? { book: v.book, bookId: v.book_id, chapter: v.chapter, verseStart: v.verse_start, verseEnd: v.verse_end }
    : parseScriptureRef(v.reference);

/**
 * /series/[id] — the series as a course overview: a navy cover, what it
 * teaches, its parts in order (each opens its lesson), the scriptures and
 * declarations it keeps returning to. Asking sits in the side panel, scoped
 * to the whole series.
 */
export default function SeriesOverview({ seriesId }) {
  const entry = useMemo(() => ({ type: "series", seriesId }), [seriesId]);
  const {
    loading,
    notFound,
    series,
    parts,
    seriesDecls,
    scriptureStats,
    summary,
    summaryLoading,
    summarySuggestions,
  } = useSeriesBundle(entry, { withSeriesExtras: true, withSummary: true });

  const [panelOpen, setPanelOpen] = useState(null);
  const [watching, setWatching] = useState(null);
  const [translation, setTranslation] = useState("KJV");
  const [showAllDecls, setShowAllDecls] = useState(false);
  const [toast, showToast] = useToast();
  const docked = useMediaQuery(PANEL_DOCKED_QUERY);
  const panelShown = panelOpen ?? docked;
  const sheetShown = panelOpen === true && !docked;

  const pageTitle = series ? `${seriesName(series.title)} · Series Study` : "Series Study · FaithHub";
  useEffect(() => {
    if (document.title !== pageTitle) document.title = pageTitle;
  });

  // Remember this series for the home page's "Pick up where you left off".
  useEffect(() => {
    if (!series || !parts.length) return;
    recordLastLesson({
      kind: "series",
      href: `/series/${series.id}`,
      title: series.title,
      seriesId: series.id,
      seriesTitle: series.title,
      parts: parts.length,
      videoId: parts.find((p) => p.youtube_video_id)?.youtube_video_id || null,
      // Every part's video, so the home card can skip one YouTube has taken down.
      videoIds: parts.map((p) => p.youtube_video_id).filter(Boolean),
    });
  }, [series, parts]);

  const partBySermon = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const context = useMemo(() => (series ? { seriesId: series.id, seriesTitle: series.title } : null), [series]);

  const describeMoment = (seg) => {
    const p = parts.find((x) => x.youtube_video_id && x.youtube_video_id === seg.video_id);
    return p ? `Part ${p.part_number} · ${partTitle(p.title, series.title)}` : null;
  };

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
        defaultScopeType="series"
        suggestions={summarySuggestions}
        onCite={setWatching}
        onClose={() => setPanelOpen(false)}
        describeMoment={describeMoment}
      />
    ) : null;

  const covers = parts.map((p) => p.youtube_video_id).filter(Boolean);
  const decls = showAllDecls ? seriesDecls : seriesDecls.slice(0, DECL_PREVIEW);
  const dateRange = series ? formatDateRange(series.start_date, series.end_date) : "";

  return (
    <ToolShell
      kind="lesson"
      back={<Link href="/series" className="hover:text-brand-navy">Series Study</Link>}
      title={series ? seriesName(series.title) : ""}
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
      panelLabel="Ask about this series"
      onOpenStudy={openStudyHere}
      overlay={toast}
    >
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div aria-hidden="true" className="px-3 pt-3 sm:px-6 sm:pt-6">
            <div className="h-80 rounded-[1.75rem] bg-brand-sky motion-safe:animate-pulse sm:rounded-[2.5rem]" />
          </div>
        ) : notFound || !series ? (
          <div className="mx-auto max-w-xl px-6 py-24 text-center">
            <h1 className="font-display text-3xl font-medium text-brand-ink">We couldn&rsquo;t find that series</h1>
            <p className="mt-3 text-brand-gray">It may have been renamed, or the link is incomplete.</p>
            <Link
              href="/series"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-bold text-white hover:bg-brand-deep"
            >
              All series <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            {/* Cover */}
            <div className="px-3 pt-3 sm:px-6 sm:pt-6">
              <section className="relative overflow-hidden rounded-[1.75rem] bg-brand-deep px-6 py-12 text-white sm:rounded-[2.5rem] sm:px-12 sm:py-16 lg:px-16 lg:py-20">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <YtThumb
                    ids={covers}
                    className="absolute inset-0 h-full w-full object-cover opacity-[0.14] mix-blend-luminosity"
                  />
                  <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-navy/80 blur-3xl" />
                  <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]" />
                  <Rings className="absolute -bottom-56 -right-56 h-[36rem] w-[36rem] text-white/[0.07]" />
                </div>
                <div className="relative max-w-3xl">
                  <p className="text-sm text-white/70">
                    A series in {parts.length} {parts.length === 1 ? "part" : "parts"}
                    {dateRange && ` · ${dateRange}`}
                  </p>
                  <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-balance sm:text-6xl">
                    {seriesName(series.title)}
                  </h1>
                </div>
              </section>
            </div>

            <div className="mx-auto w-full max-w-4xl px-4 pb-32 sm:px-8">
              {(summaryLoading || summary) && (
                <Section id="summary" title="What this series teaches">
                  {summary ? (
                    <div className="max-w-2xl text-justify [hyphens:auto] text-lg leading-relaxed text-brand-ink/85">
                      <ReactMarkdown components={SUMMARY_MARKDOWN}>{summary}</ReactMarkdown>
                    </div>
                  ) : (
                    <div aria-label="Reading the series…" className="max-w-2xl space-y-3">
                      {[92, 100, 84, 60].map((w) => (
                        <div key={w} className="h-4 rounded-full bg-brand-sky motion-safe:animate-pulse" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                </Section>
              )}

              <Section id="parts" title="The parts" intro={`${parts.length} messages, in the order they were preached`}>
                <ol className="space-y-3">
                  {parts.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/sermon/${p.id}`}
                        className="group flex items-center gap-4 rounded-[1.25rem] border border-brand-navy/10 bg-white p-3 pr-4 transition-[border-color,box-shadow] hover:border-brand-navy/25 hover:shadow-[0_24px_50px_-35px_rgba(23,58,104,0.45)] sm:gap-5"
                      >
                        <span className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-xl bg-brand-sky sm:w-40">
                          {p.youtube_video_id && (
                            <img
                              src={`https://img.youtube.com/vi/${p.youtube_video_id}/mqdefault.jpg`}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                          <span className="absolute left-2 top-2 grid h-7 min-w-[1.75rem] place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-brand-navy shadow">
                            {p.part_number}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-brand-gray">
                            Part {p.part_number}
                            {partDate(p) && ` · ${partDate(p)}`}
                          </span>
                          {/* No `block` beside line-clamp-* — it overrides the -webkit-box
                              display the clamp needs, and the text spills instead of clamping. */}
                          <span className="mt-1 line-clamp-2 font-display text-lg font-medium leading-snug text-brand-ink sm:text-xl">
                            {partTitle(p.title, series.title)}
                          </span>
                          {p.summary && (
                            <span className="mt-1 line-clamp-2 hidden text-sm text-brand-gray sm:block">{p.summary}</span>
                          )}
                        </span>
                        <ArrowRight
                          size={18}
                          aria-hidden="true"
                          className="hidden flex-shrink-0 text-brand-navy/40 transition-transform group-hover:translate-x-1 group-hover:text-brand-navy sm:block"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              </Section>

              {scriptureStats?.top?.length > 0 && (
                <Section
                  id="scriptures"
                  title="Scriptures he returned to"
                  intro="The verses opened most across these messages"
                  action={<TranslationToggle value={translation} onChange={setTranslation} />}
                >
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {scriptureStats.top.map((v) => (
                      <li key={v.reference}>
                        <VerseCard
                          reference={v.reference}
                          passage={passageFor(v)}
                          translation={translation}
                          meta={v.count > 1 ? `Read ${v.count} times` : null}
                          className="h-full"
                        />
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/word"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:underline"
                  >
                    Every scripture Rev. Peter has preached, in The Word <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </Section>
              )}

              {seriesDecls.length > 0 && (
                <Section id="declarations" title="Declarations from this series" intro="Speak them over your life">
                  <ul className="divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                    {decls.map((d) => {
                      const p = partBySermon.get(d.sermon_id);
                      return (
                        <DeclarationLine
                          key={d.id}
                          declaration={{ ...d, sermon_title: p?.title || series.title }}
                          onWatch={setWatching}
                          onCopy={(text) => copyText(text, showToast)}
                          sourceLabel={p ? `Part ${p.part_number} · ${partTitle(p.title, series.title)}` : null}
                        />
                      );
                    })}
                  </ul>
                  {seriesDecls.length > DECL_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setShowAllDecls((v) => !v)}
                      className="mt-4 text-sm font-semibold text-brand-navy hover:underline"
                    >
                      {showAllDecls ? "Show fewer" : `Show all ${seriesDecls.length}`}
                    </button>
                  )}
                </Section>
              )}
            </div>
          </>
        )}
      </div>

      {panel && !sheetShown && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Ask about this series"
          /* Icon-only on a phone: the labelled pill ran half the width of the
             screen and sat on top of whatever part you were reading. The
             label comes back where there's room for it. */
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-20 inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-brand-navy text-sm font-bold text-white shadow-xl shadow-brand-navy/30 transition-colors hover:bg-brand-deep sm:h-auto sm:w-auto sm:px-5 sm:py-3.5 xl:hidden"
        >
          <Sparkles size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Ask about this series</span>
        </button>
      )}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
