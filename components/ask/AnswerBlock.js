"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, RotateCcw } from "lucide-react";
import { extractScriptures, plainText } from "@/lib/ask-format";
import { SCOPE_ALL } from "@/lib/studies";
import { STARTER_QUESTIONS } from "@/lib/ask-examples";
import { scrollToElement } from "@/lib/scroll";
import { displayTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";
import AnswerBody from "./AnswerBody";
import MomentsRow from "./MomentsRow";
import ScriptureMargin, { verseAnchor } from "./ScriptureMargin";
import FollowUps from "./FollowUps";
import { SCOPE_ICONS, scopePhrase } from "./ScopeChip";

const STATUS_TEXT = "text-base font-medium text-brand-ink/70 sm:text-lg";
const RETRY_TEXT = "Still in high demand — trying once more…";

function Dots() {
  return (
    <span className="flex flex-shrink-0 gap-1" aria-hidden="true">
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-brand-navy/40 motion-safe:animate-pulse"
          style={{ animationDelay: `${d * 150}ms` }}
        />
      ))}
    </span>
  );
}

function StatusLine({ children }) {
  return (
    <p role="status" className={cn("mt-8 flex items-center gap-3", STATUS_TEXT)}>
      <Dots />
      {children}
    </p>
  );
}

// What the search says while it runs. The route sends nothing until retrieval
// is done, so there is no real progress to report: the phases just advance on
// a timer and are worded to stay true whichever one is showing. The last one
// holds (looping back to the start would look stuck), then a slow-going note.
// Scriptures are only fetched by the global /api/ask, so only that scope says so.
function phasesFor(type) {
  const all = type === "all";
  const closing = all ? 11800 : 8800;
  return [
    { at: 0, text: `Searching ${scopePhrase({ type })}…` },
    { at: 2800, text: "Reading through Rev. Peter’s teaching…" },
    { at: 5800, text: "Finding the moments that speak to this…" },
    ...(all ? [{ at: 8800, text: "Checking the scriptures he opened…" }] : []),
    { at: closing, text: "Putting your answer together…" },
    { at: 18000, text: "Still working — this one is taking a little longer…" },
  ];
}

/**
 * The wait between asking and the first word. `startedAt` is the block's id
 * (the moment it was asked), so leaving the page and coming back mid-search
 * picks the phases up where they'd got to instead of restarting them.
 */
function SearchingStatus({ scope, startedAt, retrying }) {
  const type = scope?.type || "all";
  const phases = useMemo(() => phasesFor(type), [type]);
  const stepAt = (ms) => phases.reduce((n, p, i) => (ms >= p.at ? i : n), 0);
  const [step, setStep] = useState(() => stepAt(Date.now() - startedAt));

  useEffect(() => {
    const t = setInterval(() => setStep(stepAt(Date.now() - startedAt)), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases, startedAt]);

  const text = retrying ? RETRY_TEXT : phases[step].text;

  return (
    <div className="mt-8 sm:mt-10">
      {/* One steady announcement — the rotating text below would be re-read
          every few seconds by a screen reader. */}
      <p role="status" className="sr-only">
        {retrying ? RETRY_TEXT : `Searching ${scopePhrase(scope)}…`}
      </p>
      <p aria-hidden="true" className={cn("flex items-center gap-3", STATUS_TEXT)}>
        <Dots />
        <span
          key={retrying ? "retry" : step}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
        >
          {text}
        </span>
      </p>
      {/* The answer's own shape, faint — where the words will land. */}
      <div aria-hidden="true" className="mt-7 max-w-3xl space-y-3">
        {["w-full", "w-[94%]", "w-[68%]"].map((w) => (
          <div key={w} className={cn("h-3.5 rounded-full bg-brand-sky/70 motion-safe:animate-pulse", w)} />
        ))}
      </div>
    </div>
  );
}

/**
 * One question laid out as a research brief: the question as a heading, the
 * answer as article text with a margin of the scriptures it names, related
 * questions, then the cited moments. While it searches, the heading is
 * followed by a status line that steps through phases (SearchingStatus).
 */
export default function AnswerBlock({
  block,
  index,
  total,
  isLast,
  density = "page",
  busy,
  onCite,
  onAsk,
  onRetry,
  describeMoment,
}) {
  const [hoverCite, setHoverCite] = useState(null);
  const [focusedVerse, setFocusedVerse] = useState(null);
  const focusTimer = useRef(null);
  useEffect(() => () => clearTimeout(focusTimer.current), []);

  const page = density === "page";
  const scope = block.scope || SCOPE_ALL;
  const ScopeIcon = SCOPE_ICONS[scope.type] || Globe;
  const isError = block.status === "error";
  const hasSources = Object.keys(block.segmentMap || {}).length > 0;
  // A stream with no sources is the route's honest "nothing found" answer.
  const refused = !isError && !hasSources && !!block.answer;
  const scriptures = block.status === "done" && hasSources ? extractScriptures(block.answer) : [];

  const focusVerse = (ref) => {
    setFocusedVerse(ref);
    const el = document.getElementById(verseAnchor(block.id, ref));
    if (el) scrollToElement(el, { align: "nearest", offset: 24, nested: true });
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusedVerse(null), 2400);
  };

  const long = block.question.length > 110;
  const headingSize = page
    ? long
      ? "text-2xl sm:text-3xl"
      : "text-3xl sm:text-4xl"
    : long
    ? "text-xl"
    : "text-2xl";

  return (
    <article id={`q-${block.id}`} data-block={block.id} className="scroll-mt-4">
      <header>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-gray">
          <ScopeIcon size={14} aria-hidden="true" className="text-brand-navy/60" />
          <span>{scope.type === "all" ? "Across every message" : `In ${displayTitle(scope.label)}`}</span>
          {total > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Question {index + 1} of {total}
              </span>
            </>
          )}
        </p>
        <h2
          title={block.question.length > 280 ? block.question : undefined}
          className={cn(
            "mt-3 font-display font-medium leading-[1.12] tracking-tight text-brand-ink text-balance",
            headingSize,
            // A pasted essay shouldn't become a page-long heading.
            block.question.length > 280 && "line-clamp-4"
          )}
        >
          {block.question}
        </h2>
      </header>

      {/* The document isn't a live region (it would re-read the answer on
          every streamed chunk), so announce once, when the answer is done. */}
      <p role="status" className="sr-only">
        {isLast && block.status === "done" && !isError ? "Answer ready." : ""}
      </p>

      {block.status === "searching" && (
        <SearchingStatus scope={scope} startedAt={block.id} retrying={!!block.retrying} />
      )}

      {!isError && !refused && block.status !== "searching" && (
        <div
          className={cn(
            page ? "mt-9 xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-12" : "mt-7"
          )}
        >
          <div className="min-w-0">
            {block.answer ? (
              <AnswerBody
                text={block.answer}
                segmentMap={block.segmentMap}
                onCite={onCite}
                onHoverCite={setHoverCite}
                onVerse={scriptures.length ? focusVerse : undefined}
                density={density}
              />
            ) : (
              <StatusLine>Writing the answer…</StatusLine>
            )}
          </div>
          {scriptures.length > 0 && (
            <ScriptureMargin
              blockId={block.id}
              refs={scriptures}
              focused={focusedVerse}
              sticky={page}
              className={page ? "mt-10 xl:mt-1" : "mt-8"}
            />
          )}
        </div>
      )}

      {isLast && block.status === "done" && hasSources && (
        <FollowUps
          className={page ? "mt-12 max-w-3xl" : "mt-9"}
          questions={block.suggestions}
          onAsk={(q) => onAsk(q, scope)}
          disabled={busy}
        />
      )}

      {hasSources && !isError && (
        <MomentsRow
          segmentMap={block.segmentMap}
          onCite={onCite}
          highlighted={hoverCite}
          describe={describeMoment}
          density={density}
          className={page ? "mt-12" : "mt-9"}
        />
      )}

      {refused && (
        <div className="mt-7 rounded-[1.5rem] border border-brand-navy/10 bg-brand-light p-5 sm:p-6">
          <p className="text-base leading-relaxed text-brand-ink/90">{plainText(block.answer)}</p>
          {block.status === "done" &&
            (scope.type !== "all" ? (
              <button
                type="button"
                onClick={() => onAsk(block.question, SCOPE_ALL)}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
              >
                <Globe size={15} aria-hidden="true" />
                Ask across every message
              </button>
            ) : (
              isLast && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-brand-ink">Try one of these</p>
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {STARTER_QUESTIONS.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => onAsk(q, SCOPE_ALL)}
                          disabled={busy}
                          className="rounded-full border border-brand-navy/15 bg-white px-3.5 py-2 text-left text-sm text-brand-navy transition-colors hover:bg-brand-sky disabled:opacity-50"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="mt-7 rounded-[1.5rem] border border-brand-navy/15 bg-brand-light p-5 sm:p-6">
          <p className="text-base leading-relaxed text-brand-ink/90">{plainText(block.answer)}</p>
          <button
            type="button"
            onClick={() => onRetry(block)}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-4 py-2 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}
    </article>
  );
}
