"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy, ListOrdered, Minimize2, Plus } from "lucide-react";
import ToolShell, { HeaderButton } from "@/components/shell/ToolShell";
import { deleteStudyWithUndo, useToast } from "@/components/shell/Toast";
import StudyDocument from "@/components/ask/StudyDocument";
import Composer from "@/components/ask/Composer";
import AskEmptyState from "@/components/ask/AskEmptyState";
import VideoModal from "@/components/VideoModal";
import {
  askQuestion,
  forgetOpenStudy,
  openStudyId,
  rememberOpenStudy,
  retryBlock,
  scopesFor,
  useStudies,
} from "@/lib/studies";
import { plainText } from "@/lib/ask-format";
import { seriesName } from "@/lib/titles";
import { cn } from "@/lib/utils";

/**
 * Ask the Word — one grounded question → answer surface over every message
 * (or, for a study begun on a lesson, that series / message).
 *
 *   /ask                      resumes the study last open this browser session;
 *                             with none, the empty state (search box, examples, your studies)
 *   /ask?new=1                a fresh study: forgets the open one, then becomes /ask
 *   /ask?study=<id>           a saved study as one document (device-local)
 *   /ask?study=<id>#q-<id>    …opened at one question
 *   /ask?q=<text>             asks once, then becomes ?study=<new id>
 *
 * Studies, streaming and persistence live in lib/studies.js; the layout comes
 * from components/shell + components/ask.
 */
export default function AskPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-white" />}>
      <AskView />
    </Suspense>
  );
}

function OutlineMenu({ study, activeBlockId, onJump }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative lg:hidden">
      <HeaderButton
        icon={ListOrdered}
        label="Outline"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-brand-navy/10 bg-white p-1.5 shadow-xl shadow-brand-navy/15">
          <p className="px-3 pb-1 pt-2 text-xs text-brand-gray">
            {study.blocks.length} questions in this study
          </p>
          <ol className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {study.blocks.map((b, i) => {
              const current = String(b.id) === String(activeBlockId);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onJump(b.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-baseline gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm leading-snug transition-colors",
                      current ? "bg-brand-sky font-medium text-brand-navy" : "text-brand-ink hover:bg-brand-sky/60"
                    )}
                  >
                    <span className="flex-shrink-0 text-xs font-bold tabular-nums text-brand-gray">{i + 1}</span>
                    <span className="line-clamp-2">{b.question}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-5xl px-4 pt-12 sm:px-8">
      <div className="h-4 w-40 rounded-full bg-brand-sky motion-safe:animate-pulse" />
      <div className="mt-5 h-10 w-3/4 rounded-2xl bg-brand-sky motion-safe:animate-pulse" />
      <div className="mt-8 flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-video w-60 flex-shrink-0 rounded-2xl bg-brand-sky/70 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function AskView() {
  const params = useSearchParams();
  const studyParam = params.get("study");
  const qParam = params.get("q");
  const newParam = params.get("new");
  const { studies, busy, ready } = useStudies();
  // A bare /ask means "Ask the Word", not "start over": it picks up the study
  // last open this session. ?new=1 (the New study buttons) opts out.
  const resumeId = ready && !studyParam && !qParam && !newParam ? openStudyId() : null;
  const openId = studyParam || resumeId;
  const study = useMemo(
    () => (openId ? studies.find((s) => String(s.id) === String(openId)) || null : null),
    [studies, openId]
  );
  const studyId = study?.id ?? null;

  const [scopeType, setScopeType] = useState(null); // null → follow the study's latest question
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [watching, setWatching] = useState(null); // moment playing in the video modal
  // Raised clear of the docked composer.
  const [toast, showToast] = useToast({ offset: "7.5rem" });
  const docRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setScopeType(null);
    setActiveBlockId(null);
  }, [studyParam]);

  const scopes = scopesFor(study?.context);
  const latestType = study?.blocks[study.blocks.length - 1]?.scope?.type;
  const scope = scopes.find((s) => s.type === (scopeType ?? latestType ?? "all")) || scopes[0];

  const ask = (question, scopeOverride) => {
    const r = askQuestion({ studyId: study?.id ?? null, question, scope: scopeOverride || scope });
    if (!r) {
      if (busy) showToast("One moment — the current answer is still coming in.");
      return false;
    }
    setScopeType(null);
    if (!study) window.history.pushState(null, "", `/ask?study=${r.studyId}`);
    return true;
  };

  // ?q= — ask once (the home page search box routes here), then drop the
  // param so a reload doesn't ask again.
  const handledQ = useRef(false);
  useEffect(() => {
    if (!ready || !qParam || handledQ.current) return;
    handledQ.current = true;
    const r = askQuestion({ question: qParam.slice(0, 2000) });
    if (!r) showToast("One moment — the current answer is still coming in.");
    window.history.replaceState(null, "", r ? `/ask?study=${r.studyId}` : "/ask");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, qParam]);

  // A ?study= this device doesn't have (a link from another device, or one
  // just deleted) falls back to the empty state.
  const seenStudies = useRef(new Set());
  useEffect(() => {
    if (!ready || !studyParam) return;
    if (study) {
      seenStudies.current.add(studyParam);
      return;
    }
    if (!seenStudies.current.has(studyParam)) {
      showToast("That study isn’t saved on this device.");
    }
    window.history.replaceState(null, "", "/ask");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, studyParam, study]);

  // Remember what's open, so leaving for another tool and coming back resumes it.
  useEffect(() => {
    if (studyId != null) rememberOpenStudy(studyId);
  }, [studyId]);

  // ?new=1 — start fresh: drop the remembered study and tidy the URL.
  useEffect(() => {
    if (!newParam) return;
    forgetOpenStudy();
    window.history.replaceState(null, "", "/ask");
  }, [newParam]);

  // A resumed study gets its own URL, like one opened from the rail.
  useEffect(() => {
    if (resumeId && studyId != null) window.history.replaceState(null, "", `/ask?study=${studyId}`);
  }, [resumeId, studyId]);

  // Empty state on a desktop pointer: put the cursor in the search box.
  const emptyState = !studyParam && studyId == null;
  useEffect(() => {
    if (ready && emptyState && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [ready, emptyState]);

  // Re-asserted every render: Next re-applies the layout's metadata title on
  // client navigations, which would otherwise win.
  const pageTitle = study ? `${study.title} · Ask the Word` : "Ask the Word · FaithHub";
  useEffect(() => {
    if (document.title !== pageTitle) document.title = pageTitle;
  });

  const jumpTo = (id) => {
    docRef.current?.scrollToBlock(id);
    if (study) window.history.replaceState(null, "", `/ask?study=${study.id}#q-${id}`);
  };

  const copyStudy = async () => {
    if (!study) return;
    const lines = [`${study.title} — Ask the Word study`, ""];
    study.blocks.forEach((b, i) => lines.push(`${i + 1}. ${b.question}`, "", plainText(b.answer), ""));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Study copied to clipboard");
    } catch {
      showToast("Couldn’t copy — clipboard unavailable");
    }
  };

  // A study begun beside a lesson keeps a way back to it — the counterpart to
  // the panel's "Open full page". Without it the maximize button is a one-way
  // door: the browser's Back works, but nothing on screen says so, and one
  // "New study" in between rewrites that history entry.
  const origin = study?.context?.sermonId
    ? { href: `/sermon/${study.context.sermonId}`, label: study.context.sermonTitle || "This message" }
    : study?.context?.seriesId
    ? { href: `/series/${study.context.seriesId}`, label: seriesName(study.context.seriesTitle || "This series") }
    : null;

  const actions = study ? (
    <>
      {origin && <HeaderButton icon={Minimize2} label={`Back to ${origin.label}`} href={origin.href} iconOnly />}
      {study.blocks.length > 1 && (
        <OutlineMenu study={study} activeBlockId={activeBlockId} onJump={jumpTo} />
      )}
      <HeaderButton icon={Copy} label="Copy study" onClick={copyStudy} />
      <Link
        href="/ask?new=1"
        aria-label="New study"
        title="New study"
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-navy px-3 text-sm font-medium text-white transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 sm:h-9"
      >
        <Plus size={16} aria-hidden="true" />
        <span className="hidden sm:inline">New study</span>
      </Link>
    </>
  ) : null;

  return (
    <ToolShell
      kind="ask"
      title={study ? study.title : "New study"}
      titleAs={study ? "h1" : "p"}
      back={
        origin ? (
          <Link href={origin.href} className="hover:text-brand-navy">
            {origin.label}
          </Link>
        ) : null
      }
      actions={actions}
      activeStudyId={study?.id}
      activeBlockId={activeBlockId}
      onJumpToBlock={jumpTo}
      overlay={toast}
    >
      {studyParam && !study ? (
        <DocumentSkeleton />
      ) : study ? (
        <>
          <StudyDocument
            key={study.id}
            ref={docRef}
            study={study}
            density="page"
            busy={busy}
            onCite={setWatching}
            onAsk={ask}
            onRetry={(b) => retryBlock(study.id, b.id)}
            onActiveBlockChange={setActiveBlockId}
          />
          <Composer
            variant="docked"
            busy={busy}
            onSubmit={ask}
            scopes={scopes}
            scope={scope}
            onScopeChange={(s) => setScopeType(s.type)}
            placeholder="Ask a follow-up…"
            hint="Answers come only from Rev. Peter’s recorded messages — every claim is cited."
            inputRef={inputRef}
          />
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <AskEmptyState
            onAsk={ask}
            busy={busy}
            studies={studies}
            inputRef={inputRef}
            onDeleteStudy={(id) => deleteStudyWithUndo(id, showToast)}
          />
        </div>
      )}

      {/* Ask is a read-along document — a citation opens as the corner
          mini-player so it doesn't take over the page you're reading. Expand
          is one tap away. */}
      <VideoModal seg={watching} onClose={() => setWatching(null)} initialMinimized />
    </ToolShell>
  );
}
