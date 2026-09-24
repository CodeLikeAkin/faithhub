"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, FileText, Flame, Languages, Plus, RefreshCw, Save, Search } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { StatusBadge } from "@/components/admin/ui";
import { Btn, Chip, ConfirmBtn, Field, Input, Notice } from "@/components/admin/controls";
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
  const [numbers, setNumbers] = useState(() => Object.fromEntries(parts.map((p) => [p.sermon_id, p.part_number])));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => setNumbers(Object.fromEntries(parts.map((p) => [p.sermon_id, p.part_number]))), [parts]);

  const changed = parts.filter((p) => Number(numbers[p.sermon_id]) !== p.part_number);
  const invalid = parts.some((p) => !(Number.isInteger(Number(numbers[p.sermon_id])) && Number(numbers[p.sermon_id]) >= 1));
  const dupes = useMemo(() => {
    const seen = {};
    for (const p of parts) seen[numbers[p.sermon_id]] = (seen[numbers[p.sermon_id]] || 0) + 1;
    return Object.keys(seen).filter((k) => seen[k] > 1);
  }, [numbers, parts]);
  const nextPart = Math.max(0, ...parts.map((p) => p.part_number)) + 1;

  const done = (text) => {
    setNotice({ tone: "success", text });
    router.refresh();
  };
  const failed = (e) => setNotice({ tone: "error", text: e.message });

  async function saveNumbers() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/series/${series.id}/parts`, {
        method: "PATCH",
        body: { parts: parts.map((p) => ({ sermon_id: p.sermon_id, part_number: Number(numbers[p.sermon_id]) })) },
      });
      done("Part numbers saved.");
    } catch (e) {
      failed(e);
    }
    setSaving(false);
  }

  async function remove(sermonId) {
    setBusy(sermonId);
    try {
      await adminFetch(`/api/admin/series/${series.id}/parts`, { method: "DELETE", body: { sermon_id: sermonId } });
      done("Message taken out of the series. It no longer shows in the catalog.");
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

  const sorted = [...parts].sort((a, b) => a.part_number - b.part_number);
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
            <p className="mt-1 text-sm text-slate-500">Change a part number, then save. Removing a message takes it out of the catalog.</p>
          </div>
          <Btn icon={Save} busy={saving} disabled={!changed.length || invalid} onClick={saveNumbers}>
            Save part numbers{changed.length ? ` (${changed.length})` : ""}
          </Btn>
        </header>
        {dupes.length > 0 && (
          <Notice tone="info" className="mx-6 mt-4">
            Part {dupes.join(", ")} is used more than once. That&apos;s fine for a morning and evening session, otherwise fix it.
          </Notice>
        )}
        <ul className="mt-4 divide-y divide-slate-100">
          {sorted.map((p) => {
            const dead = p.video_status === "private" || p.video_status === "deleted";
            return (
              <li key={p.sermon_id} className="grid grid-cols-[72px_1fr] items-center gap-x-4 gap-y-3 px-6 py-4 lg:grid-cols-[72px_112px_minmax(0,1fr)_auto_auto]">
                <div>
                  <label htmlFor={`part-${p.sermon_id}`} className="sr-only">Part number for {p.title}</label>
                  <Input
                    id={`part-${p.sermon_id}`}
                    type="number"
                    min={1}
                    max={999}
                    value={numbers[p.sermon_id] ?? ""}
                    onChange={(e) => setNumbers((n) => ({ ...n, [p.sermon_id]: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className={cn("px-3 text-center font-bold", Number(numbers[p.sermon_id]) !== p.part_number && "border-brand-navy ring-4 ring-brand-navy/15")}
                  />
                </div>
                <div className="relative hidden aspect-video overflow-hidden rounded-xl bg-brand-sky lg:block">
                  <YtThumb ids={p.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">{p.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    {fmtDate(p.sermon_date)}
                    {dead && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#912018]">
                        <StatusBadge tone="critical" className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" /> Video won&apos;t play
                      </span>
                    )}
                  </p>
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <PiecePips p={pieces?.[p.sermon_id]} />
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <ConfirmBtn question="Take it out?" confirmLabel="Remove" busy={busy === p.sermon_id} onConfirm={() => remove(p.sermon_id)}>
                    Remove
                  </ConfirmBtn>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

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
