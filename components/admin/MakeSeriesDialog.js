"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Btn, ConfirmBtn, Field, Input, Notice } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";
import { draftSeries } from "@/lib/admin-series";
import { preachedOn, splitTitle } from "@/lib/admin-titles";

/**
 * "Make a series" for messages ticked on the Messages page. Same rules as the
 * suggestions on the Series page: it only adds, a message already in a series
 * is left alone, and a name that already exists is refused (the server checks).
 */
export default function MakeSeriesDialog({ messages, onClose, onCreated }) {
  const free = useMemo(() => messages.filter((m) => !m.series_id), [messages]);
  const inSeries = messages.length - free.length;

  const draft = useMemo(() => draftSeries(free), [free]);
  const [title, setTitle] = useState(draft.title);
  const [rows, setRows] = useState(() => draft.parts.map((p) => ({ m: p, part: String(p.part_number) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    nameRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const numbers = rows.map((r) => Number(r.part));
  const badNumber = rows.some((r, i) => !Number.isInteger(numbers[i]) || numbers[i] < 1 || numbers[i] > 999);
  const shared = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))];
  const noTranscript = rows.filter((r) => !r.m.transcript).length;
  const name = title.replace(/\s+/g, " ").trim();
  const problem =
    rows.length < 2 ? "A series needs at least 2 messages." : name.length < 4 ? "Give the series a name of at least 4 characters." : badNumber ? "Every message needs a part number from 1 to 999." : "";

  const setPart = (id, part) => setRows((all) => all.map((r) => (r.m.id === id ? { ...r, part } : r)));
  const leaveOut = (id) => setRows((all) => all.filter((r) => r.m.id !== id));

  async function create() {
    setBusy(true);
    setError("");
    try {
      const parts = rows.map((r) => ({ sermon_id: r.m.id, part_number: Number(r.part) }));
      const { id } = await adminFetch("/api/admin/series", { method: "POST", body: { title: name, parts } });
      onCreated({ id, title: name, parts });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-series-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:fade-in motion-safe:duration-200 sm:rounded-[1.75rem]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <h2 id="make-series-title" className="text-lg font-bold leading-snug text-brand-ink">
              Make a series
            </h2>
            <p className="mt-1 text-sm text-slate-500">Creating one only adds. Nothing is deleted, and you can fix the numbers afterwards.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-brand-sky hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field
            id="make-series-name"
            label="Series name"
            hint="Future uploads join this series when this name appears in their YouTube title."
          >
            <Input id="make-series-name" ref={nameRef} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          {inSeries > 0 && (
            <Notice tone="info">
              {inSeries} of the ticked {inSeries === 1 ? "message is" : "messages are"} already in a series and {inSeries === 1 ? "is" : "are"} left out.
            </Notice>
          )}
          {noTranscript > 0 && (
            <Notice tone="warn">
              {noTranscript} {noTranscript === 1 ? "message has" : "messages have"} no transcript yet. Don&apos;t open this series on the live site until
              {noTranscript === 1 ? " it does" : " they do"}, or its summary will be written without the sermons.
            </Notice>
          )}
          {shared.length > 0 && (
            <Notice tone="info">
              Two messages share part {shared.join(", ")} (often a morning and evening session). That&apos;s allowed. Change the numbers if it isn&apos;t right.
            </Notice>
          )}

          <ol className="divide-y divide-slate-100 rounded-2xl bg-slate-50">
            {rows.map(({ m, part }) => {
              const { title: t } = splitTitle(m.title);
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <label className="flex flex-shrink-0 items-center gap-2 text-sm font-bold text-brand-navy">
                    Part
                    <input
                      type="number"
                      min={1}
                      max={999}
                      inputMode="numeric"
                      value={part}
                      onChange={(e) => setPart(m.id, e.target.value)}
                      aria-label={`Part number for ${t}`}
                      className="w-16 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-center text-sm tabular-nums text-brand-ink focus:border-brand-navy focus:outline-none focus:ring-4 focus:ring-brand-navy/15"
                    />
                  </label>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-brand-ink" title={m.title}>
                      {t}
                    </span>
                    <span className="block text-xs text-slate-500">{preachedOn(m)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => leaveOut(m.id)}
                    disabled={busy}
                    aria-label={`Leave out ${t}`}
                    title="Leave this one out"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-slate-500">
            Part numbers set the order. Messages are listed oldest first; a number the church wrote in the title is used as is.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 px-6 py-4">
          <Notice tone="error">{error || (rows.length && problem && !busy ? problem : "")}</Notice>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Btn>
            <ConfirmBtn
              variant="primary"
              size="md"
              question="Create it on the live site?"
              confirmLabel="Create series"
              busy={busy}
              disabled={!!problem}
              onConfirm={create}
            >
              Create series
            </ConfirmBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
