"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, RotateCcw } from "lucide-react";
import { extractScriptures, plainText } from "@/lib/ask-format";
import { SCOPE_ALL } from "@/lib/studies";
import { STARTER_QUESTIONS } from "@/lib/ask-examples";
import { scrollToElement } from "@/lib/scroll";
import { displayTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";
import AnswerBody from "./AnswerBody";
import MomentsRow, { MomentsSkeleton } from "./MomentsRow";
import ScriptureMargin, { verseAnchor } from "./ScriptureMargin";
import FollowUps from "./FollowUps";
import { SCOPE_ICONS, scopePhrase } from "./ScopeChip";

function StatusLine({ children }) {
  return (
    <p role="status" className="mt-6 flex items-center gap-3 text-sm font-medium text-brand-gray">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 rounded-full bg-brand-navy/40 motion-safe:animate-pulse"
            style={{ animationDelay: `${d * 150}ms` }}
          />
        ))}
      </span>
      {children}
    </p>
  );
}

/**
 * One question laid out as a research brief: the question as a heading, the
 * cited moments right under it, the answer as article text with a margin of
 * the scriptures it names, then related questions.
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
        <>
          <MomentsSkeleton density={density} />
          <StatusLine>
            {block.retrying ? "Still in high demand — trying once more…" : `Searching ${scopePhrase(scope)}…`}
          </StatusLine>
        </>
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
