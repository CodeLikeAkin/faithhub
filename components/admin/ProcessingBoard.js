"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, RotateCcw, X } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { StatusBadge } from "@/components/admin/ui";
import { Btn, Chip, ConfirmBtn, Notice } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";
import { WORKER_ONLINE_MINUTES, minutesSince, timeAgo } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const POLL_MS = 5000;

// The steps a job goes through, in order, keyed by the worker's event stages.
const STEPS = [
  { key: "library", label: "Saved" },
  { key: "series", label: "Series" },
  { key: "transcript", label: "Transcript" },
  { key: "scriptures", label: "Scriptures" },
  { key: "words", label: "Word studies" },
  { key: "verify", label: "Checked" },
];

const STATUS = {
  queued: { label: "Waiting", tone: "neutral" },
  running: { label: "Processing", tone: "warning" },
  done: { label: "Finished", tone: "good" },
  failed: { label: "Failed", tone: "critical" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function Steps({ job, events }) {
  const reached = new Set((events || []).map((e) => e.stage));
  const current = [...(events || [])].reverse().find((e) => STEPS.some((s) => s.key === e.stage))?.stage;
  const doneAll = job.status === "done";
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Progress">
      {STEPS.map((s, i) => {
        const isCurrent = job.status === "running" && s.key === current;
        const isDone = doneAll || (reached.has(s.key) && !isCurrent);
        return (
          <li key={s.key} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                isDone && "bg-brand-navy text-white",
                isCurrent && "bg-[#fab219]/25 text-brand-ink",
                !isDone && !isCurrent && "bg-slate-100 text-slate-500"
              )}
            >
              {isDone && <Check size={12} strokeWidth={3} aria-hidden="true" />}
              {isCurrent && <Loader2 size={12} aria-hidden="true" className="motion-safe:animate-spin" />}
              {s.label}
              <span className="sr-only">{isDone ? " (done)" : isCurrent ? " (in progress)" : " (not yet)"}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}

function Pieces({ result }) {
  if (!result) return null;
  const items = [
    ["Searchable", result.segments > 0],
    ["Scriptures", result.scriptures > 0],
    ["Word studies", result.word_studies > 0],
    ["Declarations", result.declarations > 0],
    ["Study notes", result.notes],
  ];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map(([label, ok]) => (
        <li key={label}>
          <Chip tone={ok ? "good" : "outline"}>
            {ok ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
            {label}
            <span className="sr-only">{ok ? " ready" : " missing"}</span>
          </Chip>
        </li>
      ))}
    </ul>
  );
}

function JobRow({ job, events, now, onAction, busyId }) {
  const [open, setOpen] = useState(job.status === "running" || job.status === "failed");
  const s = STATUS[job.status] || STATUS.queued;
  const title = job.title || job.youtube_video_id;
  const when =
    job.status === "queued"
      ? `Added ${timeAgo(job.created_at, now)}`
      : job.status === "running"
      ? `Started ${timeAgo(job.started_at, now)}`
      : `Finished ${timeAgo(job.finished_at, now)}`;
  const lines = events || [];
  const waiting = job.result && (!job.result.declarations || (job.result.in_catalog && !job.result.notes));

  return (
    <li className="rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl bg-brand-sky sm:w-36">
          <YtThumb ids={job.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">{title}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <StatusBadge tone={s.tone} className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" />
                <span className="font-semibold text-brand-ink">{s.label}</span>
                <span>{when}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.status === "queued" && (
                <ConfirmBtn question="Stop it?" confirmLabel="Stop" busy={busyId === job.id} onConfirm={() => onAction(job.id, "cancel")}>
                  Cancel
                </ConfirmBtn>
              )}
              {(job.status === "failed" || job.status === "cancelled") && (
                <Btn variant="secondary" size="sm" icon={RotateCcw} busy={busyId === job.id} onClick={() => onAction(job.id, "retry")}>
                  Try again
                </Btn>
              )}
            </div>
          </div>

          {job.status !== "queued" && job.status !== "cancelled" && <Steps job={job} events={lines} />}
          {job.status === "failed" && job.error && <Notice tone="error">{job.error}</Notice>}
          {job.status === "done" && <Pieces result={job.result} />}
          {job.status === "done" && waiting && (
            <p className="text-sm text-slate-600">
              Declarations and notes come from the careful pass.{" "}
              <Link href="/admin/careful-pass" className="font-semibold text-brand-navy underline underline-offset-2">
                Open Careful pass
              </Link>
            </p>
          )}

          {lines.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 rounded-full text-sm font-semibold text-brand-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
              >
                <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
                {open ? "Hide details" : `Show details (${lines.length})`}
              </button>
              {open && (
                <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl bg-slate-50 p-3 text-sm">
                  {lines.map((e, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex gap-3",
                        e.level === "error" && "text-[#912018]",
                        e.level === "warn" && "text-[#7a4f00]",
                        e.level === "info" && "text-slate-700"
                      )}
                    >
                      <time className="flex-shrink-0 tabular-nums text-slate-400" dateTime={e.at}>
                        {new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}
                      </time>
                      <span className="min-w-0 break-words">{e.message}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ProcessingBoard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await adminFetch("/api/admin/jobs");
      setData(d);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Poll while anything is waiting or running; pause while the tab is hidden.
  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    timer.current = setInterval(tick, POLL_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  async function act(id, action) {
    setBusyId(id);
    try {
      await adminFetch(`/api/admin/jobs/${id}`, { method: "POST", body: { action } });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  }

  if (!data) {
    return error ? (
      <Notice tone="error">{error}</Notice>
    ) : (
      <div className="space-y-4" aria-busy="true" aria-label="Loading the queue">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-3xl bg-white/70 ring-1 ring-brand-navy/[0.05] motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }

  const now = new Date(data.now).getTime();
  const mins = minutesSince(data.worker?.last_seen_at, now);
  const online = mins !== null && mins <= WORKER_ONLINE_MINUTES;
  const active = data.jobs.filter((j) => j.status === "queued" || j.status === "running");
  const finished = data.jobs.filter((j) => j.status !== "queued" && j.status !== "running");

  return (
    <div className="space-y-8">
      <div
        className={cn(
          "flex items-start gap-3 rounded-3xl p-5",
          online ? "bg-white ring-1 ring-brand-navy/[0.07]" : "bg-brand-deep text-white"
        )}
      >
        <StatusBadge tone={online ? "good" : "warning"} className="mt-0.5" />
        <div>
          <p className="font-semibold">
            {online ? "Processing computer connected" : mins === null ? "Processing computer hasn't connected yet" : "Processing computer is offline"}
          </p>
          <p className={cn("mt-1 text-sm", online ? "text-slate-500" : "text-brand-mist")}>
            {online
              ? `Last checked in ${timeAgo(data.worker.last_seen_at, now)}. It picks up one message at a time.`
              : mins === null
              ? "Set up n8n on your PC with the FaithHub workflow. Anything you add waits safely until then."
              : `Last seen ${timeAgo(data.worker.last_seen_at, now)}. Turn on your PC and n8n; waiting messages start automatically.`}
          </p>
        </div>
      </div>

      <Notice tone="error">{error}</Notice>

      <section aria-labelledby="active-title" className="space-y-4">
        <h2 id="active-title" className="text-lg font-bold text-brand-ink">
          Waiting and in progress <span className="font-normal text-slate-500">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
            <p className="font-semibold text-brand-ink">Nothing waiting</p>
            <p className="mt-1 text-sm text-slate-500">
              Add new messages on the{" "}
              <Link href="/admin/add" className="font-semibold text-brand-navy underline underline-offset-2">
                Add sermons
              </Link>{" "}
              page.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {active.map((j) => (
              <JobRow key={j.id} job={j} events={data.events[j.id]} now={now} onAction={act} busyId={busyId} />
            ))}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section aria-labelledby="done-title" className="space-y-4">
          <h2 id="done-title" className="text-lg font-bold text-brand-ink">Recently finished</h2>
          <ul className="space-y-4">
            {finished.map((j) => (
              <JobRow key={j.id} job={j} events={data.events[j.id]} now={now} onAction={act} busyId={busyId} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
