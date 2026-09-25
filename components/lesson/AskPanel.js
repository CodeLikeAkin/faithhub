"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Maximize2, Plus, X } from "lucide-react";
import StudyDocument from "@/components/ask/StudyDocument";
import Composer from "@/components/ask/Composer";
import { askQuestion, latestStudyFor, retryBlock, scopesFor, useStudies } from "@/lib/studies";

/**
 * Asking, beside a lesson or series: the same study document + composer as
 * /ask, in a narrow panel. It resumes the latest study begun in this series
 * (or on this solo message), and "Open full page" continues that very study
 * on /ask — one study, two views.
 *
 * context = { seriesId?, seriesTitle?, sermonId?, sermonTitle?, partNumber? }
 */
export default function AskPanel({
  context,
  defaultScopeType,
  openStudy,
  suggestions = [],
  hasPlayer = false,
  onCite,
  onClose,
  describeMoment,
}) {
  const { studies, busy, ready } = useStudies();
  const [studyId, setStudyId] = useState(undefined); // undefined → resume the latest
  const [scopeType, setScopeType] = useState(defaultScopeType);

  // The lesson moved to another part: its "This message" follows along.
  useEffect(() => setScopeType(defaultScopeType), [defaultScopeType, context.sermonId]);

  // A study opened from the rail (it belongs to this series or message).
  // Keyed on `at`, so opening the same study twice still shows it.
  useEffect(() => {
    if (openStudy) setStudyId(openStudy.id);
  }, [openStudy?.id, openStudy?.at]);

  const resumed = useMemo(
    () => latestStudyFor(studies, { seriesId: context.seriesId, sermonId: context.sermonId }),
    [studies, context.seriesId, context.sermonId]
  );
  const study =
    studyId === undefined ? resumed : studyId === null ? null : studies.find((s) => s.id === studyId) || null;

  const scopes = scopesFor(context);
  const scope = scopes.find((s) => s.type === scopeType) || scopes[scopes.length - 1];

  const ask = (question, scopeOverride) => {
    const r = askQuestion({ studyId: study?.id ?? null, question, scope: scopeOverride || scope, context });
    if (!r) return false;
    setStudyId(r.studyId);
    return true;
  };

  const heading =
    scope.type === "message"
      ? "Ask about this message"
      : scope.type === "series"
      ? "Ask about this series"
      : "Ask about anything he has taught";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 flex-shrink-0 items-center gap-1 border-b border-brand-navy/10 pl-5 pr-2 sm:h-16">
        <p className="min-w-0 flex-1 truncate font-display text-lg font-medium text-brand-ink">
          {study ? study.title : heading}
        </p>
        {study && (
          <>
            <Link
              href={`/ask?study=${study.id}`}
              aria-label="Open this study full page"
              title="Open full page"
              className="grid h-10 w-10 place-items-center rounded-full text-brand-navy transition-colors hover:bg-brand-sky"
            >
              <Maximize2 size={17} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setStudyId(null)}
              aria-label="Start a new study"
              title="New study"
              className="grid h-10 w-10 place-items-center rounded-full text-brand-navy transition-colors hover:bg-brand-sky"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the Ask panel"
          title="Close"
          className="grid h-10 w-10 place-items-center rounded-full text-brand-gray transition-colors hover:bg-brand-sky hover:text-brand-navy"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      {study ? (
        <StudyDocument
          key={study.id}
          study={study}
          density="panel"
          busy={busy}
          onCite={onCite}
          onAsk={ask}
          onRetry={(b) => retryBlock(study.id, b.id)}
          describeMoment={describeMoment}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 custom-scrollbar">
          {/* No heading here: the panel header already names the scope, and a
              second "Ask anything about this message" only said it twice. */}
          <p className="text-sm leading-relaxed text-brand-gray">
            Every answer comes from Rev. Peter&rsquo;s own words
            {scope.type === "message" ? " in this message" : scope.type === "series" ? " in this series" : ""}, with
            the moments it came from.{hasPlayer ? " Tap a moment and the video jumps to it." : ""}
          </p>
          {ready && suggestions.length > 0 && scope.type === "series" && (
            <div className="mt-7">
              <h3 className="text-sm font-bold text-brand-ink">Questions to start with</h3>
              <ul className="mt-2 divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                {suggestions.slice(0, 4).map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => ask(q)}
                      disabled={busy}
                      className="group flex w-full items-center justify-between gap-3 py-3 text-left text-sm text-brand-ink transition-colors hover:text-brand-navy disabled:opacity-50"
                    >
                      <span>{q}</span>
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                        className="flex-shrink-0 text-brand-navy/35 group-hover:text-brand-navy"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Composer
        variant="docked"
        width="panel"
        busy={busy}
        onSubmit={ask}
        scopes={scopes}
        scope={scope}
        onScopeChange={(s) => setScopeType(s.type)}
        relative
        placeholder={study ? "Ask a follow-up…" : "Ask a question…"}
      />
    </div>
  );
}
