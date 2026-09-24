"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, FileText, Flame, GripVertical, Languages, ListOrdered, Plus, RefreshCw, Save, Search, Undo2 } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { StatusBadge } from "@/components/admin/ui";
import { Btn, Chip, ConfirmBtn, Field, Input, Notice } from "@/components/admin/controls";
import { useSortableList } from "@/components/admin/useSortableList";
import { adminFetch } from "@/lib/admin-client";
import { fmtDate } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const PIECES = [
  { key: "segments", label: "Searchable", icon: Search },
  { key: "scriptures", label: "Scriptures", icon: BookOpen },
  { key: "word_studies", label: "Word studies", icon: Languages },
  { key: "declarations", label: "Declarations", icon: Flame },
  { key: "notes", label: "Study notes", icon: FileText },
];

function PiecePips({ p }) {
  if (!p) return <span className="text-xs text-slate-400">Pieces not known</span>;
  return (
    <ul className="flex gap-1">
      {PIECES.map(({ key, label, icon: Icon }) => {
        const ok = key === "declarations" ? p.declarations > 0 : !!p[key];
        return (
          <li
            key={key}
            title={`${label}: ${ok ? "done" : "missing"}`}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              ok ? "bg-brand-navy text-white" : "border border-dashed border-slate-300 text-slate-400"
            )}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="sr-only">{`${label}: ${ok ? "done" : "missing"}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Rename({ series, onSaved }) {
  const [title, setTitle] = useState(series.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = title.trim() !== series.title;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminFetch(`/api/admin/series/${series.id}`, { method: "PATCH", body: { title } });
      onSaved("Name saved.");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field
        id="series-name"
        label="Series name"
        error={error}
        hint="New uploads join this series when this exact name appears in their YouTube title."
        className="flex-1"
      >
        <Input id="series-name" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Btn type="submit" icon={Save} busy={busy} disabled={!changed || title.trim().length < 4} className="sm:mb-7">
        Save name
      </Btn>
    </form>
  );
}

function AddPart({ seriesId, nextPart, onAdded }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [part, setPart] = useState(nextPart);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => setPart(nextPart), [nextPart]);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await adminFetch(`/api/admin/sermons?unlinked=1&q=${encodeURIComponent(q.trim())}`);
        setResults(r.sermons);
      } catch (e) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  async function add(sermonId) {
    setBusyId(sermonId);
    setError("");
    try {
      await adminFetch(`/api/admin/series/${seriesId}/parts`, {
        method: "POST",
        body: { sermon_id: sermonId, part_number: Number(part) },
      });
      setQ("");
      setResults(null);
      onAdded("Message added.");
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <Field id="add-search" label="Find a message that's in no series" hint="Type words from its YouTube title.">
          <Input id="add-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Ephesians Part 16" />
        </Field>
        <Field id="add-part" label="As part">
          <Input id="add-part" type="number" min={1} max={999} value={part} onChange={(e) => setPart(e.target.value)} />
        </Field>
      </div>
      <Notice tone="error">{error}</Notice>
      {results && (
        results.length ? (
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {results.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="relative aspect-video w-20 flex-shrink-0 overflow-hidden rounded-lg bg-brand-sky">
                  <YtThumb ids={s.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-brand-ink">{s.title}</p>
                  <p className="text-xs text-slate-500">{fmtDate(s.sermon_date)}</p>
                </div>
                <Btn size="sm" icon={Plus} busy={busyId === s.id} disabled={!(Number(part) >= 1)} onClick={() => add(s.id)}>
                  Add
                </Btn>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No message outside a series matches that.</p>
        )
      )}
    </div>
  );
}

export default function SeriesEditor({ series, parts, pieces }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [announce, setAnnounce] = useState("");

  // Until something is moved, each message keeps the number it has (some series
  // deliberately have two "Part 1"s for a morning and evening session, or skip a
  // number). Moving a message, or pressing "Renumber from 1", makes the numbers
  // follow the order on screen: 1, 2, 3...
  const canonical = useMemo(
    () =>
      [...parts].sort(
        (a, b) =>
          a.part_number - b.part_number ||
          (a.sermon_date || "").localeCompare(b.sermon_date || "") ||
          a.title.localeCompare(b.title)
      ),
    [parts]
  );
  const slots = useMemo(() => canonical.map((p) => p.part_number), [canonical]);
  const byId = useMemo(() => new Map(parts.map((p) => [p.sermon_id, p])), [parts]);

  const [order, setOrder] = useState(() => canonical.map((p) => p.sermon_id));
  const [renumber, setRenumber] = useState(false);
  useEffect(() => {
    setOrder(canonical.map((p) => p.sermon_id));
    setRenumber(false);
  }, [canonical]);
  // For the one render between `parts` changing and the effect above catching up.
  const ids = order.length === parts.length && order.every((id) => byId.has(id)) ? order : canonical.map((p) => p.sermon_id);

  const alreadyClean = slots.every((n, i) => n === i + 1);
  const numbers = useMemo(() => (renumber ? slots.map((_, i) => i + 1) : slots), [renumber, slots]);
  const rows = ids.map((id, i) => ({ ...byId.get(id), newNumber: numbers[i] }));
  const changed = rows.filter((r) => r.newNumber !== r.part_number);
  const dupes = useMemo(() => [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))], [numbers]);
  const nextPart = Math.max(0, ...parts.map((p) => p.part_number)) + 1;
  const discard = () => {
    setOrder(canonical.map((p) => p.sermon_id));
    setRenumber(false);
  };

  const { itemRef, handleProps } = useSortableList({
    ids,
    disabled: saving || parts.length < 2,
    onMove: (next, { id, to }) => {
      setOrder(next);
      setRenumber(true); // position is the number: the series reads 1, 2, 3... in the order shown
      setAnnounce(`Moved ${byId.get(id)?.title} to position ${to + 1} of ${next.length}. It is now part ${to + 1}.`);
    },
  });

  // A reorder that isn't saved is lost on reload or tab close; ask first.
  useEffect(() => {
    if (!changed.length) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed.length]);

  const done = (text) => {
    setNotice({ tone: "success", text });
    router.refresh();
  };
  const failed = (e) => setNotice({ tone: "error", text: e.message });

  async function saveOrder() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/series/${series.id}/parts`, {
        method: "PATCH",
        body: { parts: rows.map((r) => ({ sermon_id: r.sermon_id, part_number: r.newNumber })) },
      });
      done("Order saved.");
    } catch (e) {
      failed(e);
    }
    setSaving(false);
  }

  async function remove(sermonId) {
    setBusy(sermonId);
    try {
      const r = await adminFetch(`/api/admin/series/${series.id}/parts`, { method: "DELETE", body: { sermon_id: sermonId } });
      done(
        "Message taken out of the series. It no longer shows in the catalog." +
          (r.moved ? ` The ${r.moved} later ${r.moved === 1 ? "part" : "parts"} moved up by one.` : "")
      );
    } catch (e) {
      failed(e);
    }
    setBusy(null);
  }

  async function refreshSummary() {
    setBusy("summary");
    try {
      await adminFetch(`/api/admin/series/${series.id}`, { method: "POST", body: { action: "refresh_summary" } });
      done("Summary cleared. A fresh one is written the next time someone opens this series.");
    } catch (e) {
      failed(e);
    }
    setBusy(null);
  }

  const card = "rounded-3xl border border-brand-navy/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,42,78,0.04)]";

  return (
    <div className="space-y-6">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section aria-labelledby="name-title" className={cn(card, "xl:col-span-2")}>
          <h2 id="name-title" className="mb-4 text-lg font-bold text-brand-ink">Name</h2>
          <Rename series={series} onSaved={done} />
        </section>

        <section aria-labelledby="summary-title" className={card}>
          <h2 id="summary-title" className="text-lg font-bold text-brand-ink">Summary</h2>
          <p className="mt-1 text-sm text-slate-500">
            {series.study_summary
              ? "Written once, the first time someone opened the series. Rewrite it after adding parts."
              : "Not written yet. It's written the first time someone opens the series."}
          </p>
          {series.study_summary && (
            <p className="mt-3 line-clamp-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{series.study_summary}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {series.study_summary && (
              <ConfirmBtn
                variant="secondary"
                question="Rewrite it?"
                confirmLabel="Rewrite"
                busy={busy === "summary"}
                onConfirm={refreshSummary}
                icon={RefreshCw}
              >
                Rewrite summary
              </ConfirmBtn>
            )}
            <a
              href={`/series/${series.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-brand-navy hover:bg-brand-sky"
            >
              View on the site <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>

      <section aria-labelledby="parts-title" className="overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)]">
        <header className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="parts-title" className="text-lg font-bold text-brand-ink">
              Messages <span className="font-normal text-slate-500">({parts.length})</span>
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {parts.length > 1 ? "Drag a message by its grip to move it. The numbers follow the order, 1, 2, 3…, once you save. " : ""}
              Removing a message takes it out of the catalog and moves the later parts up.
              {!alreadyClean && !renumber && slots[0] > 1 ? ` These numbers start at ${slots[0]}.` : ""}
            </p>
          </div>
          {!alreadyClean && !renumber && (
            <Btn
              variant="secondary"
              size="sm"
              icon={ListOrdered}
              disabled={saving}
              onClick={() => setRenumber(true)}
              title={`Number these 1 to ${parts.length}, in the order shown. Nothing changes until you save.`}
            >
              Renumber from 1
            </Btn>
          )}
        </header>
        {dupes.length > 0 && (
          <Notice tone="info" className="mx-6 mt-4">
            Part {dupes.join(", ")} is used by more than one message (fine for a morning and evening session). Moving any message
            renumbers the whole series 1, 2, 3… in the order shown, so those shared numbers would go.
          </Notice>
        )}
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        <ul className="mt-4 divide-y divide-slate-100" aria-label="Messages in this series, in part order">
          {rows.map((p) => {
            const dead = p.video_status === "private" || p.video_status === "deleted";
            const moved = p.newNumber !== p.part_number;
            return (
              <li
                key={p.sermon_id}
                ref={itemRef(p.sermon_id)}
                className={cn(
                  "grid grid-cols-[auto_56px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 bg-white px-4 py-4 sm:px-6 lg:grid-cols-[auto_56px_112px_minmax(0,1fr)_auto_auto] lg:gap-x-4",
                  moved && "bg-brand-sky/50",
                  "data-[dragging=true]:rounded-2xl data-[dragging=true]:bg-white data-[dragging=true]:shadow-[0_18px_40px_-14px_rgba(16,42,78,0.45)] data-[dragging=true]:ring-1 data-[dragging=true]:ring-brand-navy/20"
                )}
              >
                {parts.length > 1 ? (
                  <button
                    type="button"
                    {...handleProps(p.sermon_id)}
                    aria-label={`Move ${p.title}. Drag it, or use the up and down arrow keys.`}
                    className="flex h-11 w-9 cursor-grab items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-brand-sky hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy active:cursor-grabbing"
                  >
                    <GripVertical size={20} aria-hidden="true" />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "flex h-11 items-center justify-center rounded-2xl text-lg font-bold tabular-nums transition-colors",
                    moved ? "bg-brand-navy text-white" : "bg-brand-sky text-brand-navy"
                  )}
                >
                  <span className="sr-only">Part </span>
                  {p.newNumber}
                </span>
                <div className="relative hidden aspect-video overflow-hidden rounded-xl bg-brand-sky lg:block">
                  <YtThumb ids={p.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">{p.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                    {fmtDate(p.sermon_date)}
                    {moved && <span className="font-semibold text-brand-navy">Was part {p.part_number}</span>}
                    {dead && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#912018]">
                        <StatusBadge tone="critical" className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" /> Video won&apos;t play
                      </span>
                    )}
                  </p>
                </div>
                <div className="col-span-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:contents">
                  <PiecePips p={pieces?.[p.sermon_id]} />
                  <ConfirmBtn
                    question="Take it out?"
                    confirmLabel="Remove"
                    busy={busy === p.sermon_id}
                    disabled={changed.length > 0 || saving}
                    title={changed.length ? "Save or discard the new order first." : undefined}
                    onConfirm={() => remove(p.sermon_id)}
                  >
                    Remove
                  </ConfirmBtn>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {changed.length > 0 && (
        <div className="sticky bottom-4 z-30">
          <div
            role="region"
            aria-label="Unsaved order"
            className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-3xl bg-brand-navy px-5 py-3 text-white shadow-[0_16px_40px_-12px_rgba(16,42,78,0.55)]"
          >
            <p className="text-sm font-semibold">
              {changed.length} {changed.length === 1 ? "message" : "messages"} will change number
            </p>
            <div className="flex items-center gap-2">
              <Btn
                variant="ghost"
                size="sm"
                icon={Undo2}
                disabled={saving}
                onClick={discard}
                className="text-white hover:bg-white/10"
              >
                Discard
              </Btn>
              <Btn variant="secondary" size="sm" icon={Save} busy={saving} onClick={saveOrder}>
                Save order
              </Btn>
            </div>
          </div>
        </div>
      )}

      <section aria-labelledby="add-title" className={card}>
        <h2 id="add-title" className="mb-4 text-lg font-bold text-brand-ink">Add a message to this series</h2>
        <AddPart seriesId={series.id} nextPart={nextPart} onAdded={done} />
      </section>

      <p className="text-sm text-slate-500">
        <Chip tone="outline">Tip</Chip> Every change here shows on the live site straight away and is recorded in Review, under History.
      </p>
    </div>
  );
}
